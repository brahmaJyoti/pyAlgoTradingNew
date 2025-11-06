import yfinance as yf
import pandas as pd
import warnings
import numpy as np

# Suppress FutureWarning from yfinance
warnings.simplefilter(action='ignore', category=FutureWarning)

WEEKS_TO_DAYS = 5


def run_analysis_and_strategies(ticker, long_ma_period_weeks, short_ma_period_days, start_date, initial_sum,
                                growth_target_percent):
    """
    Downloads daily stock data, calculates MAs and signals, and runs two trade simulations.
    Returns: (dict_of_data, error_message)
    """
    try:
        # 1. Data Retrieval and MA Calculation
        long_ma_period_days = long_ma_period_weeks * WEEKS_TO_DAYS

        data = yf.download(ticker, start=start_date, end=None, interval='1d', progress=False, multi_level_index=False)

        if data.empty or 'Close' not in data.columns:
            return None, f"Error: Could not retrieve daily data for ticker '{ticker}' from {start_date}."

        required_days = max(long_ma_period_days, short_ma_period_days)
        if len(data) < required_days:
            return None, f"Error: Only {len(data)} days of data found since {start_date}. Need at least {required_days} days."

        data['Long_MA'] = data['Close'].rolling(window=long_ma_period_days).mean()
        data['Short_MA'] = data['Close'].rolling(window=short_ma_period_days).mean()
        data.dropna(subset=['Long_MA', 'Short_MA'], inplace=True)

        if data.empty:
            return None, "Error: Not enough data points to calculate the moving averages after cleanup."

        # 2. Identify Buy and Sell Signals
        data['Diff'] = data['Short_MA'] - data['Long_MA']
        data['Prev_Diff'] = data['Diff'].shift(1)
        # Buy occurs when Diff crosses from negative (below) to positive (above)
        data['Buy_Signal'] = (data['Prev_Diff'] < 0) & (data['Diff'] >= 0)
        # Sell occurs when Diff crosses from positive (above) to negative (below)
        data['Sell_Signal'] = (data['Prev_Diff'] > 0) & (data['Diff'] <= 0)

        buy_signals = data[data['Buy_Signal']]
        sell_signals = data[data['Sell_Signal']]

        # 3. Strategy Simulation Setup
        initial_investment_per_strategy = initial_sum / 2

        # --- 3a. STRATEGY 1: MA Crossover Only (100% Buy, 100% Sell) ---
        cash_1 = initial_investment_per_strategy
        holdings_1 = 0

        for _, row in data.iterrows():
            price = row['Close']

            # 1. Check for Sell Signal
            if row['Sell_Signal'] and holdings_1 > 0:
                cash_1 += holdings_1 * price  # Sell entire position
                holdings_1 = 0

            # 2. Check for Buy Signal
            if row['Buy_Signal'] and holdings_1 == 0 and cash_1 > 0:
                shares = cash_1 / price
                holdings_1 = shares
                cash_1 = 0

        # Final P&L calculation for Strategy 1
        final_value_1 = cash_1
        if holdings_1 > 0:
            final_value_1 += holdings_1 * data.iloc[-1]['Close']
        total_gain_1 = final_value_1 - initial_investment_per_strategy
        roi_1 = (total_gain_1 / initial_investment_per_strategy) * 100

        # --- 3b. STRATEGY 2: Hybrid (50% Target, 50% MA) ---
        cash_2 = initial_investment_per_strategy
        holdings_2 = 0
        shares_half = 0
        buy_price_2 = None
        target_price_2 = None
        target_hit_done = False

        for _, row in data.iterrows():
            price = row['Close']

            # We must be in a trade to check target hit or sell signal
            if holdings_2 > 0:

                # A. Check Target Hit (50% sell of original position)
                if not target_hit_done and price >= target_price_2:
                    cash_2 += shares_half * price
                    holdings_2 -= shares_half
                    target_hit_done = True

                # B. Check for MA Sell Signal (remaining position sell)
                if row['Sell_Signal'] and holdings_2 > 0:
                    cash_2 += holdings_2 * price  # Sell remaining position
                    holdings_2 = 0
                    target_hit_done = False

                    # C. Check for MA Buy Signal (Start new trade)
            if row['Buy_Signal'] and holdings_2 == 0 and cash_2 > 0:
                shares = cash_2 / price
                holdings_2 = shares
                shares_half = shares / 2  # Store the half-share amount for profit-taking
                cash_2 = 0
                buy_price_2 = price
                target_price_2 = buy_price_2 * (1 + growth_target_percent / 100)
                target_hit_done = False

                # Final P&L calculation for Strategy 2
        final_value_2 = cash_2
        if holdings_2 > 0:
            final_value_2 += holdings_2 * data.iloc[-1]['Close']
        total_gain_2 = final_value_2 - initial_investment_per_strategy
        roi_2 = (total_gain_2 / initial_investment_per_strategy) * 100

        # --- 4. Prepare Table Data (based on MA Signals) ---
        all_signals = pd.concat([buy_signals.assign(SignalType='Buy'), sell_signals.assign(SignalType='Sell')])
        all_signals_chrono = all_signals.sort_index(ascending=True)

        table_data_with_gain = []
        last_buy_price = None

        short_header = f'{short_ma_period_days} Day SMA'
        long_header = f'{long_ma_period_weeks} Week SMA'

        # Metrics tracking for the display table / Strategy 1 performance
        all_trade_gains_value = []
        all_trade_buy_prices = []
        profitable_trades_count = 0

        for date, row in all_signals_chrono.iterrows():
            signal_type = row['SignalType']
            close_price = row['Close']

            signal_entry = {
                "date": date.strftime('%Y-%m-%d'),
                "signal_type": signal_type,
                "close_price": close_price,
                "short_ma": row['Short_MA'],
                "long_ma": row['Long_MA'],
                "short_header": short_header,
                "long_header": long_header,
                "gain_value": None,
                "gain_percent": None
            }

            if signal_type == 'Buy':
                last_buy_price = close_price

            elif signal_type == 'Sell' and last_buy_price is not None:
                gain = close_price - last_buy_price
                gain_percent = (gain / last_buy_price) * 100

                signal_entry["gain_value"] = gain
                signal_entry["gain_percent"] = gain_percent

                all_trade_gains_value.append(gain)
                all_trade_buy_prices.append(last_buy_price)

                if gain > 0:
                    profitable_trades_count += 1

                last_buy_price = None

            table_data_with_gain.append(signal_entry)

        # Calculate Averages and Accuracy for the MA strategy (Table Display)
        total_trades_display = len(all_trade_gains_value)
        if total_trades_display > 0:
            avg_gain_value_display = sum(all_trade_gains_value) / total_trades_display

            # FIX: Calculate average percentage gain correctly across all trades
            avg_gain_percent_display = sum(
                [(g / b) * 100 for g, b in zip(all_trade_gains_value, all_trade_buy_prices)]) / total_trades_display
            accuracy_rate = (profitable_trades_count / total_trades_display) * 100

            formatted_accuracy_rate = f"{accuracy_rate:.2f}%"
            formatted_avg_gain_value = f"${avg_gain_value_display:.2f}"
            formatted_avg_gain_percent = f"{avg_gain_percent_display:.2f}%"
        else:
            formatted_avg_gain_value = "N/A"
            formatted_avg_gain_percent = "N/A"
            formatted_accuracy_rate = "N/A"

        # Re-sort table data for display (most recent first) and format values for client side
        table_data = sorted(table_data_with_gain, key=lambda x: x['date'], reverse=True)

        for entry in table_data:
            entry["close_price"] = f"${entry['close_price']:.2f}"
            entry["short_ma"] = f"${entry['short_ma']:.2f}"
            entry["long_ma"] = f"${entry['long_ma']:.2f}"

            if entry["gain_value"] is not None:
                entry["gain_value"] = f"${entry['gain_value']:.2f}"
                entry["gain_percent"] = f"{entry['gain_percent']:.2f}%"

        # --- 5. Prepare Final JSON Output ---
        output_data = {
            # Chart Data
            "dates": data.index.strftime('%Y-%m-%d').tolist(),
            "close_prices": data['Close'].tolist(),
            "short_ma_prices": data['Short_MA'].tolist(),
            "long_ma_prices": data['Long_MA'].tolist(),
            "buy_signal_dates": buy_signals.index.strftime('%Y-%m-%d').tolist(),
            "buy_signal_prices": buy_signals['Close'].tolist(),
            "sell_signal_dates": sell_signals.index.strftime('%Y-%m-%d').tolist(),
            "sell_signal_prices": sell_signals['Close'].tolist(),

            # Table Data & Metrics (Based on MA Signals)
            "short_ma_period": short_ma_period_days,
            "long_ma_period": long_ma_period_weeks,
            "table_data": table_data,
            "short_header": short_header,
            "long_header": long_header,
            "average_gain_value": formatted_avg_gain_value,
            "average_gain_percent": formatted_avg_gain_percent,
            "total_trades_display": total_trades_display,
            "accuracy_rate_percent": formatted_accuracy_rate,

            # Strategy Comparison Results
            "initial_sum": initial_sum,
            "strategy_1": {
                "final_value": final_value_1,
                "total_gain": total_gain_1,
                "roi": roi_1,
            },
            "strategy_2": {
                "final_value": final_value_2,
                "total_gain": total_gain_2,
                "roi": roi_2,
            }
        }

        return output_data, None

    except Exception as e:
        # Catch unexpected errors during simulation/download
        return None, f"An unexpected error occurred: {e}"
