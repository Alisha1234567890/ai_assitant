import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import json
from typing import Dict, Any

def generate_eda_charts(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Generates a set of Plotly charts for the given dataframe.
    Optimized for large datasets by sampling.
    """
    # 1. Optimization: Sample if the dataset is too large (> 10,000 rows)
    # This ensures smooth Plotly JSON generation and frontend rendering
    if len(df) > 10000:
        plot_df = df.sample(n=10000, random_state=42)
    else:
        plot_df = df

    charts = {}

    # Identify numeric columns for relevant plots
    numeric_cols = plot_df.select_dtypes(include=['number']).columns.tolist()

    # --- 1. Histogram (First numeric column or all if few) ---
    if numeric_cols:
        target_col = numeric_cols[0]
        fig_hist = px.histogram(
            plot_df, x=target_col, 
            title=f"Distribution of {target_col}",
            template="plotly_white",
            color_discrete_sequence=['#f06500'] # Match project orange
        )
        charts["histogram"] = json.loads(fig_hist.to_json())

    # --- 2. Boxplot (Numeric columns) ---
    if numeric_cols:
        fig_box = px.box(
            plot_df, y=numeric_cols[:5], # Limit to first 5 for clarity
            title="Statistical Outliers (Top 5 Numeric Columns)",
            template="plotly_white",
            color_discrete_sequence=['#1a6aff'] # Match project blue
        )
        charts["boxplot"] = json.loads(fig_box.to_json())

    # --- 3. Correlation Heatmap ---
    if len(numeric_cols) > 1:
        corr_matrix = plot_df[numeric_cols].corr()
        fig_heat = px.imshow(
            corr_matrix,
            text_auto=True,
            title="Feature Correlation Heatmap",
            template="plotly_white",
            color_continuous_scale='RdBu_r'
        )
        charts["correlation"] = json.loads(fig_heat.to_json())

    # --- 4. Missing Value Chart ---
    missing_data = df.isnull().sum()
    if missing_data.sum() > 0:
        missing_df = missing_data[missing_data > 0].reset_index()
        missing_df.columns = ['Column', 'Missing Count']
        fig_missing = px.bar(
            missing_df, x='Column', y='Missing Count',
            title="Missing Values by Column",
            template="plotly_white",
            color_discrete_sequence=['#f5b800'] # Match project gold
        )
        charts["missing_values"] = json.loads(fig_missing.to_json())
    else:
        # Placeholder for no missing data
        charts["missing_values"] = None

    return charts
