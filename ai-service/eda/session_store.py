import pandas as pd
from typing import Dict, Any

# Simple in-memory storage for EDA sessions
# In a production app, this would ideally use Redis or a database with TTL
_eda_sessions: Dict[str, Dict[str, Any]] = {}

def store_dataframe(session_id: str, df: pd.DataFrame):
    """Stores a dataframe in the session store."""
    if session_id not in _eda_sessions:
        _eda_sessions[session_id] = {}
    _eda_sessions[session_id]['df'] = df

def get_dataframe(session_id: str) -> pd.DataFrame:
    """Retrieves a dataframe from the session store."""
    if session_id in _eda_sessions and 'df' in _eda_sessions[session_id]:
        return _eda_sessions[session_id]['df']
    return None

def store_analysis(session_id: str, analysis: Dict[str, Any]):
    """Stores EDA analysis results in the session store."""
    if session_id not in _eda_sessions:
        _eda_sessions[session_id] = {}
    _eda_sessions[session_id]['analysis'] = analysis

def get_analysis(session_id: str) -> Dict[str, Any]:
    """Retrieves EDA analysis results from the session store."""
    if session_id in _eda_sessions and 'analysis' in _eda_sessions[session_id]:
        return _eda_sessions[session_id]['analysis']
    return None

def store_insights(session_id: str, insights: Dict[str, Any]):
    """Stores AI insights in the session store."""
    if session_id not in _eda_sessions:
        _eda_sessions[session_id] = {}
    _eda_sessions[session_id]['insights'] = insights

def get_stored_insights(session_id: str) -> Dict[str, Any]:
    """Retrieves AI insights from the session store."""
    if session_id in _eda_sessions and 'insights' in _eda_sessions[session_id]:
        return _eda_sessions[session_id]['insights']
    return None

def clear_session(session_id: str):
    """Removes a session from the store."""
    if session_id in _eda_sessions:
        del _eda_sessions[session_id]
