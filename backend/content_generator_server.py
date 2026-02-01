#!/usr/bin/env python3
"""
Content Generator Server
Provides API endpoints to generate hints and real-life examples for coding problems
"""

import sys
import os
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

# Import from local files (deployment-ready)
from prompts import HINTS_PROMPT, REAL_LIFE_PROMPT, FOLLOWUP_PROMPT_NEW
import requests

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

USAGE_TRACKER_FILE = 'usage_tracker.json'

# GPT-4o pricing (as of 2024)
COST_PER_1K_PROMPT_TOKENS = 0.0025  # $2.50 per 1M tokens = $0.0025 per 1K
COST_PER_1K_COMPLETION_TOKENS = 0.01  # $10 per 1M tokens = $0.01 per 1K

def get_current_exchange_rate():
    """Fetch current USD to INR exchange rate"""
    try:
        response = requests.get('https://api.exchangerate-api.com/v4/latest/USD', timeout=2)
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
    """Save usage tracker to JSON file"""
    with open(USAGE_TRACKER_FILE, 'w') as f:
        json.dump(tracker, f, indent=2)

def update_usage(prompt_tokens, completion_tokens, problem_name):
    """Update usage tracker with new API call"""
    tracker = load_usage_tracker()
    
    total_tokens = prompt_tokens + completion_tokens
    cost = (prompt_tokens / 1000 * COST_PER_1K_PROMPT_TOKENS) + \
           (completion_tokens / 1000 * COST_PER_1K_COMPLETION_TOKENS)
    
    tracker['total_requests'] += 1
    tracker['total_tokens'] += total_tokens
    tracker['total_cost_usd'] += cost
    tracker['prompt_tokens'] += prompt_tokens
    tracker['completion_tokens'] += completion_tokens
    tracker['last_updated'] = datetime.now().isoformat()
    
    # Add to history
    tracker['history'].append({
        'timestamp': datetime.now().isoformat(),
        'problem_name': problem_name,
        'prompt_tokens': prompt_tokens,
        'completion_tokens': completion_tokens,
        'total_tokens': total_tokens,
        'cost_usd': round(cost, 6)
    })
    
    # Keep only last 100 entries in history
    if len(tracker['history']) > 100:
        tracker['history'] = tracker['history'][-100:]
    
    save_usage_tracker(tracker)
    return tracker

def call_llm_with_tracking(system_prompt, user_prompt, temperature=0.3):
    """Call LLM and extract usage information"""
    API_URL = "http://43.204.71.128:4000/chat/completions"
    API_KEY = "sk-G-HxdSbYuEiesRDNPCHPQA"
    
    HEADERS = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    DEFAULT_METADATA = {
        "project_name": "CCBP_FRONTEND_INTERVIEW_KIT",
        "feature": "DSA_CONTENT_GENERATION",
        "step": "CSV_ENRICHMENT",
        "team": "DSA_CONTENT",
        "meta": {}
    }
    
    payload = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": temperature,
        "metadata": DEFAULT_METADATA
    }
    
    response = requests.post(
        API_URL,
        headers=HEADERS,
        json=payload,
        timeout=300
    )
    
    if response.status_code != 200:
        raise RuntimeError(
            f"LLM call failed: {response.status_code} - {response.text}"
        )
    
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    
    # Extract usage information
    usage = data.get("usage", {})
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    
    return content, prompt_tokens, completion_tokens

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
        
        # Generate hints with tracking
        print(f"Generating hints for: {problem_name}")
        hints_response, hints_prompt_tokens, hints_completion_tokens = call_llm_with_tracking(HINTS_PROMPT, base_problem)
        
        # Generate real-life examples with tracking
        print(f"Generating real-life examples for: {problem_name}")
        reallife_response, reallife_prompt_tokens, reallife_completion_tokens = call_llm_with_tracking(REAL_LIFE_PROMPT, base_problem)

        # Generate follow-up questions with tracking
        print(f"Generating follow-up questions for: {problem_name}")
        followup_response, followup_prompt_tokens, followup_completion_tokens = call_llm_with_tracking(FOLLOWUP_PROMPT_NEW, base_problem)
        
        # Update usage tracker
        total_prompt_tokens = hints_prompt_tokens + reallife_prompt_tokens + followup_prompt_tokens
        total_completion_tokens = hints_completion_tokens + reallife_completion_tokens + followup_completion_tokens
        tracker = update_usage(total_prompt_tokens, total_completion_tokens, problem_name)
        
        return jsonify({
            'success': True,
            'hints': hints_response.strip(),
            'real_life_examples': reallife_response.strip(),
            'followup_questions': followup_response.strip(),
            'usage': {
                'prompt_tokens': total_prompt_tokens,
                'completion_tokens': total_completion_tokens,
                'total_tokens': total_prompt_tokens + total_completion_tokens,
                'cost_usd': round((total_prompt_tokens / 1000 * COST_PER_1K_PROMPT_TOKENS) + 
                                 (total_completion_tokens / 1000 * COST_PER_1K_COMPLETION_TOKENS), 6)
            },
            'tracker': {
                'total_requests': tracker['total_requests'],
                'total_tokens': tracker['total_tokens'],
                'total_cost_usd': round(tracker['total_cost_usd'], 6),
                'last_updated': tracker['last_updated']
            }
        })
        
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
        content, p_tokens, c_tokens = call_llm_with_tracking(prompt, base_problem)
        tracker = update_usage(p_tokens, c_tokens, f"{problem_name} [{section_type}]")

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
