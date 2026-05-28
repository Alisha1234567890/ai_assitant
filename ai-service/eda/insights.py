import os
import json
import pandas as pd
from typing import Dict, Any
from services.rag_service import get_http_client, GROQ_API_URL, GROQ_FAST_MODEL

async def generate_ai_insights(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Generates AI-driven insights from the dataset using Groq.
    """
    # 1. Prepare data summary for the AI
    # We provide statistical summary instead of raw data to fit context limits
    summary = {
        "columns": df.columns.tolist(),
        "shape": df.shape,
        "types": df.dtypes.astype(str).to_dict(),
        "missing_values": df.isnull().sum().to_dict(),
        "numeric_summary": df.describe().to_dict() if not df.select_dtypes(include=['number']).empty else "No numeric data",
        "sample_head": df.head(3).to_dict(orient="records")
    }

    prompt = f"""
    You are an expert Data Scientist. Analyze the following dataset summary and provide structured insights in JSON format.
    
    DATASET SUMMARY:
    {json.dumps(summary, indent=2)}
    
    REQUIRED JSON STRUCTURE:
    {{
        "trends": ["list of observed trends"],
        "correlations": ["list of significant relationships"],
        "outliers": ["list of potential data anomalies"],
        "missing_value_warnings": ["warnings about data quality"],
        "recommendations": ["actionable business or technical steps"]
    }}
    
    Ensure the response is ONLY valid JSON.
    """

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {"error": "GROQ_API_KEY not configured"}

    client = get_http_client()
    payload = {
        "model": GROQ_FAST_MODEL,
        "messages": [
            {"role": "system", "content": "You are a data analysis assistant that returns strictly JSON."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    try:
        response = await client.post(GROQ_API_URL, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception as e:
        print(f"[EDA-AI] Error: {str(e)}")
        return {
            "error": "Failed to generate AI insights",
            "detail": str(e),
            "trends": [], "correlations": [], "outliers": [], "missing_value_warnings": [], "recommendations": []
        }
