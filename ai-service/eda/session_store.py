import pandas as pd
from typing import Dict

# Simple in-memory storage for dataframes
# In a production app, this would ideally use Redis or a database with TTL
_eda_sessions: Dict[str, pd.DataFrame] = {}

def store_dataframe(session_id: str, df: pd.DataFrame):
    """Stores a dataframe in the session store."""
    _eda_sessions[session_id] = df

def get_dataframe(session_id: str) -> pd.DataFrame:
    """Retrieves a dataframe from the session store."""
    return _eda_sessions.get(session_id)

def clear_session(session_id: str):
    """Removes a session from the store."""
    if session_id in _eda_sessions:
        del _eda_sessions[session_id]
