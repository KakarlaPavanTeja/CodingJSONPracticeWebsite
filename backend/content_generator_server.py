#!/usr/bin/env python3
"""
Content Generator Server
Provides API endpoints to generate hints and real-life examples for coding problems
"""

import sys
import os
import json
import fcntl
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

# Import from local files (deployment-ready)
from prompts import HINTS_PROMPT, REAL_LIFE_PROMPT, FOLLOWUP_PROMPT_NEW
from llm_client import call_llm
import requests

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

USAGE_TRACKER_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'usage_tracker.json')


def _tracked_model_label() -> str:
    """Same resolution order as llm_client (for logs / history)."""
    return (
        os.environ.get("OPENAI_MODEL_ENRICHMENT", "").strip()
        or os.environ.get("OPENAI_MODEL", "").strip()
        or "gpt-5.4"
    )


def _cost_per_1k_usd() -> tuple[float, float]:
    """
    USD per 1K prompt / completion tokens for estimates in usage_tracker.
    Set on Render to match your model's current list price (per 1K tokens).
    """
    p = os.environ.get("OPENAI_COST_PER_1K_PROMPT_USD", "0.0025").strip()
    c = os.environ.get("OPENAI_COST_PER_1K_COMPLETION_USD", "0.01").strip()
    return float(p), float(c)


def estimate_cost_usd(prompt_tokens: int, completion_tokens: int) -> float:
    cp, cc = _cost_per_1k_usd()
    return (prompt_tokens / 1000.0 * cp) + (completion_tokens / 1000.0 * cc)

def get_current_exchange_rate():
    """Fetch current USD to INR exchange rate"""
    try:
        response = requests.get('https://api.exchangerate-api.com/v4/latest/USD', timeout=5)
        if response.status_code == 200:
            return response.json().get('rates', {}).get('INR', 87.0)
    except Exception:
        pass
    return 87.0  # Fallback

def load_usage_tracker():
    """Load usage tracker from JSON file"""
    if os.path.exists(USAGE_TRACKER_FILE):
        with open(USAGE_TRACKER_FILE, 'r') as f:
            return json.load(f)
    return {
        "total_requests": 0,
        "total_tokens": 0,
        "total_cost_usd": 0.0,
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "last_updated": None,
        "history": []
    }

def save_usage_tracker(tracker):
    """Save usage tracker to JSON file with locking"""
    with open(USAGE_TRACKER_FILE, 'w') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            json.dump(tracker, f, indent=2)
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)

def update_usage(
    prompt_tokens,
    completion_tokens,
    problem_name,
    *,
    total_tokens=None,
    model=None,
):
    """
    Update usage tracker (thread-safe). Costs use OPENAI_COST_PER_1K_* env vars.

    total_tokens: if provided (e.g. from OpenAI usage), stored on the history row;
                  otherwise prompt_tokens + completion_tokens.
    model: optional label for history; defaults to tracked model from env.
    """
    # We need to lock the file for the entire Read-Modify-Write cycle
    # Since standard open() truncates on 'w', we use 'r+' or a separate lock file.
    # For simplicity with fcntl on the data file itself, we open with 'r+' to lock, read, seek 0, write, truncate.

    if not os.path.exists(USAGE_TRACKER_FILE):
        save_usage_tracker(load_usage_tracker())

    model_label = model or _tracked_model_label()
    row_total = int(total_tokens) if total_tokens is not None else int(prompt_tokens) + int(completion_tokens)
    cost = estimate_cost_usd(int(prompt_tokens), int(completion_tokens))

    with open(USAGE_TRACKER_FILE, 'r+') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            try:
                tracker = json.load(f)
            except json.JSONDecodeError:
                tracker = load_usage_tracker() # Fallback to default if corrupted

            # Update stats
            tracker['total_requests'] += 1
            tracker['total_tokens'] += row_total
            tracker['prompt_tokens'] += prompt_tokens
            tracker['completion_tokens'] += completion_tokens

            tracker['total_cost_usd'] += cost
            tracker['last_updated'] = datetime.now().isoformat()

            tracker['history'].append({
                'timestamp': datetime.now().isoformat(),
                'problem_name': problem_name,
                'model': model_label,
                'prompt_tokens': prompt_tokens,
                'completion_tokens': completion_tokens,
                'total_tokens': row_total,
                'cost_usd': cost,
            })
            
            # Write back
            f.seek(0)
            json.dump(tracker, f, indent=2)
            f.truncate()
            
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)
            
    return tracker
    

def call_llm_with_tracking(system_prompt, user_prompt, temperature=0.3):
    """Call OpenAI via llm_client (OPENAI_API_KEY, optional OPENAI_MODEL_*)."""
    content, usage = call_llm(system_prompt, user_prompt, temperature=temperature)
    prompt_tokens = int(usage.get("prompt_tokens") or 0)
    completion_tokens = int(usage.get("completion_tokens") or 0)
    total_tokens = usage.get("total_tokens")
    if total_tokens is not None:
        try:
            total_tokens = int(total_tokens)
        except (TypeError, ValueError):
            total_tokens = None
    else:
        total_tokens = None
    return content, prompt_tokens, completion_tokens, total_tokens

@app.route('/generate-content', methods=['POST'])
def generate_content():
    """
    Generate hints, real-life examples, and follow-up questions for a coding problem
    """
    try:
        data = request.json
        problem_name = data.get('problem_name', '')
        problem_description = data.get('problem_description', '')
        solution_code = data.get('solution_code', '')
        
        # Generation flags (default to True for backward compatibility or "Generate All")
        include_hints = data.get('include_hints', True)
        include_reallife = data.get('include_reallife', True)
        include_followup = data.get('include_followup', True)
        
        if not problem_name or not problem_description or not solution_code:
            return jsonify({
                'success': False,
                'error': 'Problem name, description, and solution code are all required'
            }), 400
        
        # Prepare the problem context with solution
        base_problem = f"""
Problem Name: {problem_name}

Problem Description:
{problem_description}

Solution Code:
{solution_code}
"""
        
        hints_response = None
        reallife_response = None
        followup_response = None
        
        hints_prompt_tokens = 0
        hints_completion_tokens = 0
        hints_total_tokens = None
        reallife_prompt_tokens = 0
        reallife_completion_tokens = 0
        reallife_total_tokens = None
        followup_prompt_tokens = 0
        followup_completion_tokens = 0
        followup_total_tokens = None

        # Generate hints with tracking
        if include_hints:
            print(f"Generating hints for: {problem_name}")
            hints_response, hints_prompt_tokens, hints_completion_tokens, hints_total_tokens = call_llm_with_tracking(
                HINTS_PROMPT, base_problem
            )

        # Generate real-life examples with tracking
        if include_reallife:
            print(f"Generating real-life examples for: {problem_name}")
            reallife_response, reallife_prompt_tokens, reallife_completion_tokens, reallife_total_tokens = (
                call_llm_with_tracking(REAL_LIFE_PROMPT, base_problem)
            )

        # Generate follow-up questions with tracking
        if include_followup:
            print(f"Generating follow-up questions for: {problem_name}")
            followup_response, followup_prompt_tokens, followup_completion_tokens, followup_total_tokens = (
                call_llm_with_tracking(FOLLOWUP_PROMPT_NEW, base_problem)
            )
        
        # Update usage tracker
        total_prompt_tokens = hints_prompt_tokens + reallife_prompt_tokens + followup_prompt_tokens
        total_completion_tokens = hints_completion_tokens + reallife_completion_tokens + followup_completion_tokens
        
        # Construct specific log name
        gen_types = []
        if include_hints: gen_types.append("Hints")
        if include_reallife: gen_types.append("RealLife")
        if include_followup: gen_types.append("FollowUp")
        
        usage_name = problem_name
        if len(gen_types) < 3: # If not all, specify which ones
            usage_name = f"{problem_name} [{', '.join(gen_types)}]"
        elif len(gen_types) == 3:
            usage_name = f"{problem_name} [All]"

        def _api_total_row(p, c, api_t):
            if api_t is not None:
                return int(api_t)
            return int(p) + int(c)

        batch_total_tokens = 0
        if include_hints:
            batch_total_tokens += _api_total_row(hints_prompt_tokens, hints_completion_tokens, hints_total_tokens)
        if include_reallife:
            batch_total_tokens += _api_total_row(reallife_prompt_tokens, reallife_completion_tokens, reallife_total_tokens)
        if include_followup:
            batch_total_tokens += _api_total_row(followup_prompt_tokens, followup_completion_tokens, followup_total_tokens)

        tracker = update_usage(
            total_prompt_tokens,
            total_completion_tokens,
            usage_name,
            total_tokens=batch_total_tokens,
        )

        response_data = {
            'success': True,
            'usage': {
                'prompt_tokens': total_prompt_tokens,
                'completion_tokens': total_completion_tokens,
                'total_tokens': batch_total_tokens,
                'cost_usd': round(estimate_cost_usd(total_prompt_tokens, total_completion_tokens), 6),
            },
            'tracker': {
                'total_requests': tracker['total_requests'],
                'total_tokens': tracker['total_tokens'],
                'total_cost_usd': round(tracker['total_cost_usd'], 6),
                'last_updated': tracker['last_updated']
            }
        }
        
        if hints_response is not None:
            response_data['hints'] = hints_response.strip()
            
        if reallife_response is not None:
            response_data['real_life_examples'] = reallife_response.strip()
            
        if followup_response is not None:
            response_data['followup_questions'] = followup_response.strip()

        return jsonify(response_data)
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/generate-section', methods=['POST'])
def generate_section():
    """
    Regenerate a specific section (type: 'hints', 'reallife', 'followup')
    """
    try:
        data = request.json
        problem_name = data.get('problem_name', '')
        problem_description = data.get('problem_description', '')
        solution_code = data.get('solution_code', '')
        section_type = data.get('type', '')

        if not all([problem_name, problem_description, solution_code, section_type]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400

        base_problem = f"""
Problem Name: {problem_name}

Problem Description:
{problem_description}

Solution Code:
{solution_code}
"""
        
        prompt = None
        if section_type == 'hints':
            prompt = HINTS_PROMPT
        elif section_type == 'reallife':
            prompt = REAL_LIFE_PROMPT
        elif section_type == 'followup':
            prompt = FOLLOWUP_PROMPT_NEW
        else:
            return jsonify({'success': False, 'error': 'Invalid section type'}), 400

        print(f"Regenerating {section_type} for: {problem_name}")
        content, p_tokens, c_tokens, api_total = call_llm_with_tracking(prompt, base_problem)
        row_total = int(api_total) if api_total is not None else int(p_tokens) + int(c_tokens)
        tracker = update_usage(
            p_tokens,
            c_tokens,
            f"{problem_name} [{section_type}]",
            total_tokens=row_total,
        )

        return jsonify({
            'success': True,
            'content': content.strip(),
            'type': section_type,
            'tracker': {
                'total_requests': tracker['total_requests'],
                'total_tokens': tracker['total_tokens'],
                'total_cost_usd': round(tracker['total_cost_usd'], 6),
                'last_updated': tracker['last_updated']
            }
        })

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/usage-stats', methods=['GET'])
def get_usage_stats():
    """Get current usage statistics"""
    tracker = load_usage_tracker()
    exchange_rate = get_current_exchange_rate()
    
    return jsonify({
        'total_requests': tracker['total_requests'],
        'total_tokens': tracker['total_tokens'],
        'total_cost_usd': round(tracker['total_cost_usd'], 6),
        'total_cost_inr': round(tracker['total_cost_usd'] * exchange_rate, 2),
        'exchange_rate': exchange_rate,
        'avg_cost_usd': round(tracker['total_cost_usd'] / tracker['total_requests'], 6) if tracker['total_requests'] > 0 else 0,
        'prompt_tokens': tracker['prompt_tokens'],
        'completion_tokens': tracker['completion_tokens'],
        'last_updated': tracker['last_updated'],
        'recent_history': tracker['history'] if tracker['history'] else []
    })

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    print("Starting Content Generator Server on http://localhost:5001")
    print("Press Ctrl+C to stop")
    # Ensure usage file exists
    if not os.path.exists(USAGE_TRACKER_FILE):
        save_usage_tracker(load_usage_tracker())
    app.run(host='0.0.0.0', port=5001, debug=True)
