import pandas as pd
import os
import warnings
from flask import Flask, request, jsonify, render_template
from analysis_logic import run_analysis_and_strategies  # Import the core function

# Suppress FutureWarning from yfinance (used in analysis_logic)
warnings.simplefilter(action='ignore', category=FutureWarning)

app = Flask(__name__)

# --- Default Values and Constants (Used for form pre-filling) ---
LONG_MA_PERIOD_WEEKS_DEFAULT = 50
SHORT_MA_PERIOD_DAYS_DEFAULT = 20
START_DATE_DEFAULT = '2010-01-01'
INITIAL_SUM_DEFAULT = 1000.0
GROWTH_TARGET_DEFAULT = 10.0

# --- Load Ticker Data On Startup (Fallback included) ---
TICKER_CSV_PATH = 'tickers.csv'
tickers_df = pd.DataFrame(columns=['Ticker', 'Name'])
try:
    if os.path.exists(TICKER_CSV_PATH):
        tickers_df = pd.read_csv(TICKER_CSV_PATH)
    else:
        print(f"Warning: {TICKER_CSV_PATH} not found. Using minimal fallback list.")
        fallback_data = {
            'Ticker': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'UNH'],
            'Name': ['Apple Inc.', 'Microsoft Corporation', 'Alphabet Inc.', 'Amazon.com, Inc.', 'UnitedHealth Group']
        }
        tickers_df = pd.DataFrame(fallback_data)
except Exception as e:
    print(f"Error loading {TICKER_CSV_PATH}: {e}. Using minimal fallback list.")
    if tickers_df.empty:
        fallback_data = {
            'Ticker': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'UNH'],
            'Name': ['Apple Inc.', 'Microsoft Corporation', 'Alphabet Inc.', 'Amazon.com, Inc.', 'UnitedHealth Group']
        }
        tickers_df = pd.DataFrame(fallback_data)


@app.route('/')
def index():
    """Renders the main page and passes default form values via Jinja."""
    return render_template('index.html',
                           ticker=request.args.get('ticker', 'AAPL'),
                           LONG_MA_PERIOD=request.args.get('long_ma_period', str(LONG_MA_PERIOD_WEEKS_DEFAULT)),
                           SHORT_MA_PERIOD=request.args.get('short_ma_period', str(SHORT_MA_PERIOD_DAYS_DEFAULT)),
                           START_DATE=request.args.get('start_date', START_DATE_DEFAULT),
                           INITIAL_SUM=request.args.get('initial_sum', str(INITIAL_SUM_DEFAULT)),
                           GROWTH_TARGET=request.args.get('growth_target', str(GROWTH_TARGET_DEFAULT))
                           )


@app.route('/api/analyze')
def analyze():
    """Endpoint to run the dual stock analysis and return JSON data."""
    try:
        # Extract and validate parameters
        ticker = request.args.get('ticker', '').upper()
        long_ma_period = int(request.args.get('long_ma_period', LONG_MA_PERIOD_WEEKS_DEFAULT))
        short_ma_period = int(request.args.get('short_ma_period', SHORT_MA_PERIOD_DAYS_DEFAULT))
        start_date = request.args.get('start_date', START_DATE_DEFAULT)
        initial_sum = float(request.args.get('initial_sum', INITIAL_SUM_DEFAULT))
        growth_target_percent = float(request.args.get('growth_target', GROWTH_TARGET_DEFAULT))

        if not ticker:
            return jsonify({"error": "Ticker symbol is required."}), 400
        if long_ma_period <= 0 or short_ma_period <= 0 or initial_sum <= 0:
            return jsonify({"error": "MA periods and Starting Sum must be positive."}), 400

        # Call the core analysis logic
        data, error = run_analysis_and_strategies(
            ticker, long_ma_period, short_ma_period, start_date, initial_sum, growth_target_percent
        )

        if error:
            return jsonify({"error": error}), 400

        return jsonify(data)

    except ValueError as ve:
        return jsonify({"error": f"Invalid input value: {ve}"}), 400
    except Exception as e:
        return jsonify({"error": f"Internal server error during analysis: {e}"}), 500


@app.route('/api/search_tickers')
def search_tickers():
    """Endpoint for ticker autocomplete/search."""
    query = request.args.get('q', '').lower()
    if not query:
        return jsonify([])

    filtered_df = tickers_df[
        tickers_df['Ticker'].str.lower().str.contains(query, na=False) |
        tickers_df['Name'].str.lower().str.contains(query, na=False)
        ]

    results = filtered_df.head(10).to_dict('records')

    return jsonify(results)


if __name__ == '__main__':
    # When running locally, ensure FLASK_APP=app.py is set
    # In a production environment (like the immersive canvas),
    # the runner handles execution, but this is good for local testing.
    app.run(debug=True, host='0.0.0.0', port=5000)
