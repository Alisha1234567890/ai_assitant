import os
import json
import pandas as pd
from typing import Dict, Any
from core.groq import GROQ_FAST_MODEL, call_groq_efficient

async def generate_ai_insights(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Generates AI-driven insights from the dataset with minimal Groq usage!
    First we calculate local stats, then send a tiny summary to Groq!
    """
    # --- 100% LOCAL: Calculate everything we can locally first ---
    numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
    missing = df.isnull().sum().to_dict()
    missing_cols = [k for k, v in missing.items() if v > 0]
    duplicates = int(df.duplicated().sum())
    
    trends = []
    correlations = []
    recommendations = []
    
    # Add local trends (simple observations)
    trends.append(f"The dataset contains {len(df)} rows and {len(df.columns)} columns.")
    
    if numeric_cols:
        for col in numeric_cols[:3]:
            mean_val = round(df[col].mean(), 2)
            std_val = round(df[col].std(), 2)
            trends.append(f"{col}: Average {mean_val}, Standard Deviation {std_val}")
    
    # Calculate correlations locally
    if len(numeric_cols) >= 2:
        corr_matrix = df[numeric_cols].corr()
        for i in range(len(numeric_cols)):
            for j in range(i+1, len(numeric_cols)):
                corr_val = round(corr_matrix.iloc[i,j], 2)
                if abs(corr_val) > 0.5:
                    correlations.append(f"{numeric_cols[i]} and {numeric_cols[j]}: Correlation of {corr_val}")
    
    # Local recommendations
    if missing_cols:
        recommendations.append(f"Consider handling missing values in columns: {', '.join(missing_cols)}")
    if duplicates > 0:
        recommendations.append(f"Remove {duplicates} duplicate rows")
    if len(numeric_cols) > 5:
        recommendations.append("Consider feature selection to reduce dimensionality")
    
    # Now only send a tiny summary to Groq for polishing if needed
    prompt = f"""
    Improve these dataset insights (short, 1-2 sentences each). Keep JSON format only.
    {json.dumps({
        "trends": trends,
        "correlations": correlations,
        "missing_value_warnings": [f"{k}: {v} missing" for k,v in missing.items() if v >0],
        "recommendations": recommendations
    })}
    
    Output JSON exactly like:
    {{
        "trends": [],
        "correlations": [],
        "missing_value_warnings": [],
        "recommendations": []
    }}
    """

    messages = [
        {"role": "system", "content": "Brief data insights JSON only."},
        {"role": "user", "content": prompt}
    ]

    try:
        result = await call_groq_efficient(
            messages=messages,
            model=GROQ_FAST_MODEL,
            temperature=0.2,
            max_tokens=400  # Very small token budget!
        )

        if result["success"]:
            try:
                groq_insights = json.loads(result["content"])
                # Use Groq polished insights if valid, else our local ones
                return {
                    "trends": groq_insights.get("trends", trends),
                    "correlations": groq_insights.get("correlations", correlations),
                    "missing_value_warnings": groq_insights.get("missing_value_warnings", [f"{k}: {v} missing" for k,v in missing.items() if v >0]),
                    "recommendations": groq_insights.get("recommendations", recommendations),
                    "outliers": []
                }
            except Exception as e:
                print(f"[EDA-AI] JSON Parse Error: {e}")
    except Exception as e:
        print(f"[EDA-AI] Error: {e}")
    
    # --- FALLBACK: Return our local 100% free insights if Groq fails ---
    return {
        "trends": trends,
        "correlations": correlations,
        "missing_value_warnings": [f"{k}: {v} missing" for k,v in missing.items() if v >0],
        "recommendations": recommendations,
        "outliers": []
    }
