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
from prompts import HINTS_PROMPT, REAL_LIFE_PROMPT
import requests

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

USAGE_TRACKER_FILE = 'usage_tracker.json'

# GPT-4o pricing (as of 2024)
COST_PER_1K_PROMPT_TOKENS = 0.0025  # $2.50 per 1M tokens = $0.0025 per 1K
COST_PER_1K_COMPLETION_TOKENS = 0.01  # $10 per 1M tokens = $0.01 per 1K

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
    Generate hints and real-life examples for a coding problem
    
    Expected JSON payload:
    {
        "problem_name": "Two Sum",
        "problem_description": "Given an array...",
        "solution_code": "class Solution { ... }"
    }
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
        
        # Update usage tracker
        total_prompt_tokens = hints_prompt_tokens + reallife_prompt_tokens
        total_completion_tokens = hints_completion_tokens + reallife_completion_tokens
        tracker = update_usage(total_prompt_tokens, total_completion_tokens, problem_name)
        
        return jsonify({
            'success': True,
            'hints': hints_response.strip(),
            'real_life_examples': reallife_response.strip(),
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

@app.route('/usage-stats', methods=['GET'])
def get_usage_stats():
    """Get current usage statistics"""
    tracker = load_usage_tracker()
    return jsonify({
        'total_requests': tracker['total_requests'],
        'total_tokens': tracker['total_tokens'],
        'total_cost_usd': round(tracker['total_cost_usd'], 6),
        'prompt_tokens': tracker['prompt_tokens'],
        'completion_tokens': tracker['completion_tokens'],
        'last_updated': tracker['last_updated'],
        'recent_history': tracker['history'][-10:] if tracker['history'] else []
    })

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    print("Starting Content Generator Server on http://localhost:5001")
    print("Press Ctrl+C to stop")
    app.run(host='0.0.0.0', port=5001, debug=True)
