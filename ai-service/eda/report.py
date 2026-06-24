import pandas as pd
import base64
import io
from typing import Dict, Any
import plotly.express as px
import plotly.io as pio


def generate_eda_report_html(df: pd.DataFrame, analysis: Dict[str, Any], charts: Dict[str, Any], insights: Dict[str, Any]) -> str:
    """
    Generates a complete HTML report for EDA with all analysis, charts, and insights.
    """
    
    # Make sure inputs are valid
    if not charts:
        charts = {}
    if not insights:
        insights = {}
    
    # Convert Plotly charts to HTML divs
    chart_htmls = ""
    print(f"[DEBUG] Charts keys: {list(charts.keys())}")
    for key, chart in charts.items():
        if chart is not None:
            try:
                fig = pio.from_json(pio.to_json(chart))
                chart_div = pio.to_html(fig, full_html=False, include_plotlyjs='cdn')
                chart_htmls += f"""
                    <div style="margin: 30px 0; page-break-inside: avoid;">
                        {chart_div}
                    </div>
                """
            except Exception as e:
                print(f"[DEBUG] Error converting chart {key}: {e}")
    
    if not chart_htmls:
        chart_htmls = "<p style='color: #64748b; text-align: center;'>Charts will be generated once you upload a dataset and generate insights</p>"
    
    # Build insights HTML
    insights_html = ""
    if 'trends' in insights and insights['trends']:
        insights_html += f"""
            <div class="insight-section">
                <h3 style="color: #f06500;">📈 Observed Trends</h3>
                <ul>
                    {''.join([f'<li style="margin: 8px 0;">{str(insight)}</li>' for insight in insights['trends']])}
                </ul>
            </div>
        """
    if 'correlations' in insights and insights['correlations']:
        insights_html += f"""
            <div class="insight-section">
                <h3 style="color: #1a6aff;">🔗 Correlations</h3>
                <ul>
                    {''.join([f'<li style="margin: 8px 0;">{str(insight)}</li>' for insight in insights['correlations']])}
                </ul>
            </div>
        """
    if 'missing_value_warnings' in insights and insights['missing_value_warnings']:
        insights_html += f"""
            <div class="insight-section">
                <h3 style="color: #ef4444;">⚠️ Data Warnings</h3>
                <ul>
                    {''.join([f'<li style="margin: 8px 0;">{str(insight)}</li>' for insight in insights['missing_value_warnings']])}
                </ul>
            </div>
        """
    if 'recommendations' in insights and insights['recommendations']:
        insights_html += f"""
            <div class="insight-section">
                <h3 style="color: #8b5cf6;">💡 Recommendations</h3>
                <ul>
                    {''.join([f'<li style="margin: 8px 0;">{str(insight)}</li>' for insight in insights['recommendations']])}
                </ul>
            </div>
        """
    
    if not insights_html:
        insights_html = "<p style='color: #64748b; text-align: center;'>Click 'Generate AI Insights' to get personalized AI-driven recommendations</p>"
    
    # Build sample data table
    sample_html = ""
    if not df.empty:
        try:
            sample_html = df.head(10).to_html(index=False, classes="table", border=0)
        except Exception as e:
            print(f"[DEBUG] Error creating sample table: {e}")
            sample_html = "<p style='color: #ef4444;'>Could not generate dataset preview</p>"
    else:
        sample_html = "<p style='color: #64748b; text-align: center;'>No data available</p>"
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>EDA Analysis Report</title>
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                max-width: 1200px;
                margin: 0 auto;
                padding: 40px 20px;
                background: #f8fafc;
                color: #1e293b;
                line-height: 1.6;
            }}
            .report-header {{
                background: linear-gradient(135deg, #f06500 0%, #1a6aff 100%);
                color: white;
                padding: 40px;
                border-radius: 16px;
                margin-bottom: 40px;
                box-shadow: 0 10px 40px rgba(240,101,0,0.2);
            }}
            .report-header h1 {{
                margin: 0 0 10px 0;
                font-size: 36px;
            }}
            .report-header p {{
                margin: 0;
                opacity: 0.9;
                font-size: 18px;
            }}
            .summary-cards {{
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin-bottom: 40px;
            }}
            .summary-card {{
                background: white;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            }}
            .summary-card h4 {{
                margin: 0 0 8px 0;
                color: #64748b;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }}
            .summary-card .value {{
                font-size: 32px;
                font-weight: 800;
                color: #1e293b;
            }}
            .insight-section {{
                background: white;
                padding: 24px;
                border-radius: 12px;
                margin: 20px 0;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            }}
            .insight-section h3 {{
                margin-top: 0;
                display: flex;
                align-items: center;
                gap: 10px;
            }}
            .section {{
                background: white;
                padding: 30px;
                border-radius: 12px;
                margin: 20px 0;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            }}
            .section h2 {{
                margin-top: 0;
                color: #1e293b;
                border-bottom: 3px solid #f06500;
                padding-bottom: 12px;
            }}
            .table {{
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }}
            .table th {{
                background: #f1f5f9;
                padding: 12px;
                text-align: left;
                font-weight: 700;
                border-bottom: 2px solid #e2e8f0;
            }}
            .table td {{
                padding: 12px;
                border-bottom: 1px solid #f1f5f9;
            }}
            .table tr:hover {{
                background: #f8fafc;
            }}
            @media print {{
                body {{
                    background: white;
                }}
                .report-header {{
                    box-shadow: none;
                }}
            }}
        </style>
    </head>
    <body>
        <div class="report-header">
            <h1>📊 EDA Analysis Report</h1>
            <p>Generated by AI Doc Assistant | {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </div>
        
        <div class="section">
            <h2>📋 Dataset Overview</h2>
            <div class="summary-cards">
                <div class="summary-card">
                    <h4>Total Rows</h4>
                    <div class="value">{analysis.get('rows', len(df)):,}</div>
                </div>
                <div class="summary-card">
                    <h4>Total Columns</h4>
                    <div class="value">{analysis.get('columns', len(df.columns))}</div>
                </div>
                <div class="summary-card">
                    <h4>Missing Values</h4>
                    <div class="value">{sum(analysis.get('missing_values', df.isnull().sum().to_dict()).values()):,}</div>
                </div>
                <div class="summary-card">
                    <h4>Duplicate Rows</h4>
                    <div class="value">{analysis.get('duplicates', df.duplicated().sum()):,}</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>🎯 AI Smart Insights</h2>
            {insights_html}
        </div>
        
        <div class="section">
            <h2>📊 Data Visualizations</h2>
            {chart_htmls}
        </div>
        
        <div class="section">
            <h2>📝 Dataset Preview (First 10 Rows)</h2>
            {sample_html}
        </div>
        
    </body>
    </html>
    """
    
    return html_content
