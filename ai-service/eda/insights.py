import os
import json
import pandas as pd
from typing import Dict, Any
from core.groq import GROQ_FAST_MODEL, call_groq_efficient

async def generate_ai_insights(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Generates AI-driven insights from the dataset using Groq.
    """
    # 1. Prepare data summary for the AI
    # We provide statistical summary instead of raw data to fit context limits
    # Optimization: limit numeric summary and head to avoid token bloat
    numeric_df = df.select_dtypes(include=['number'])
    numeric_summary = numeric_df.describe().round(2).to_dict() if not numeric_df.empty else "No numeric data"
    
    summary = {
        "columns": df.columns.tolist()[:50], # Limit column count
        "shape": df.shape,
        "types": {str(k): str(v) for k, v in df.dtypes.items()},
        "missing_values": df.isnull().sum().to_dict(),
        "numeric_summary": numeric_summary,
        "sample_head": df.head(3).where(pd.notnull(df), None).to_dict(orient="records")
    }

    prompt = f"""
    Analyze the following dataset summary and provide structured insights in JSON.
    
    DATASET SUMMARY:
    {json.dumps(summary)}
    
    JSON STRUCTURE:
    {{
        "trends": ["list"],
        "correlations": ["list"],
        "outliers": ["list"],
        "missing_value_warnings": ["list"],
        "recommendations": ["list"]
    }}
    """

    messages = [
        {"role": "system", "content": "You are a data analysis assistant. Return ONLY valid JSON."},
        {"role": "user", "content": prompt}
    ]

    result = await call_groq_efficient(
        messages=messages,
        model=GROQ_FAST_MODEL,
        temperature=0.1,
        response_format={"type": "json_object"}
    )

    if result["success"]:
        try:
            return json.loads(result["content"])
        except Exception as e:
            print(f"[EDA-AI] JSON Parse Error: {e}")
            
    return {
        "error": result.get("details", "Failed to generate AI insights"),
        "trends": [], "correlations": [], "outliers": [], "missing_value_warnings": [], "recommendations": []
    }
