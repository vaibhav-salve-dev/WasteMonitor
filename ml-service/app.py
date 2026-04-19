from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import os
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app)

# Model paths
MODEL_PATH = 'garbage_model.pkl'
SCALER_PATH = 'scaler.pkl'
DATA_PATH = 'real_world_garbage_data.csv'

# Global variables
model = None
scaler = None

def load_model():
    """Load the trained model and scaler"""
    global model, scaler
    try:
        model = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        print("Model and scaler loaded successfully")
        return True
    except Exception as e:
        print(f"Error loading model: {e}")
        return False

def retrain_model():
    """Retrain the model with updated data"""
    global model, scaler
    try:
        # Check if data file exists
        if not os.path.exists(DATA_PATH):
            return None, None, "Data file not found"
        
        # Load and prepare data
        df = pd.read_csv(DATA_PATH)
        
        # Required columns
        required_cols = ['Hour', 'Weight_kg', 'Distance_cm', 'Is_Weekend', 'Overflow_Status']
        
        # Check if all required columns exist
        if not all(col in df.columns for col in required_cols):
            # Try to map from CSV columns
            if 'Overflow_Status' not in df.columns and 'Status' in df.columns:
                df['Overflow_Status'] = df['Status']
            elif 'Overflow_Status' not in df.columns and 'overflow_status' in df.columns:
                df['Overflow_Status'] = df['overflow_status']
        
        X = df[['Hour', 'Weight_kg', 'Distance_cm', 'Is_Weekend']]
        y = df['Overflow_Status']
        
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.preprocessing import StandardScaler
        
        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Train model
        model = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)
        model.fit(X_scaled, y)
        
        # Save updated model
        joblib.dump(model, MODEL_PATH)
        joblib.dump(scaler, SCALER_PATH)
        
        print(f"Model retrained successfully with {len(df)} samples")
        return model, scaler, "Retraining successful"
        
    except Exception as e:
        print(f"Retraining error: {e}")
        return None, None, f"Retraining failed: {str(e)}"

# Load model on startup
if not load_model():
    print("No model found, training initial model...")
    model, scaler, msg = retrain_model()
    if model is None:
        print(f"Initial training failed: {msg}")
        # Create dummy model for demo
        from sklearn.ensemble import RandomForestClassifier
        model = RandomForestClassifier(n_estimators=10, max_depth=3)
        scaler = None

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'scaler_loaded': scaler is not None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Prediction endpoint"""
    try:
        data = request.get_json()
        
        # Validate input
        required_fields = ['hour', 'weight', 'distance', 'weekend']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing field: {field}'}), 400
        
        # Prepare features
        features = np.array([[
            data['hour'],
            data['weight'],
            data['distance'],
            data['weekend']
        ]])
        
        # Scale features if scaler exists
        if scaler is not None:
            features_scaled = scaler.transform(features)
        else:
            features_scaled = features
        
        # Make prediction
        prediction = int(model.predict(features_scaled)[0])
        
        # Get prediction probabilities if available
        confidence = None
        if hasattr(model, 'predict_proba'):
            proba = model.predict_proba(features_scaled)[0]
            confidence = float(max(proba))
        
        return jsonify({
            'status': prediction,
            'confidence': confidence,
            'message': 'Prediction successful'
        })
        
    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """Batch prediction endpoint"""
    try:
        data = request.get_json()
        
        if 'readings' not in data or not isinstance(data['readings'], list):
            return jsonify({'error': 'Invalid readings array'}), 400
        
        results = []
        for reading in data['readings']:
            features = np.array([[
                reading['hour'],
                reading['weight'],
                reading['distance'],
                reading['weekend']
            ]])
            
            if scaler is not None:
                features_scaled = scaler.transform(features)
            else:
                features_scaled = features
            
            prediction = int(model.predict(features_scaled)[0])
            results.append({'status': prediction})
        
        return jsonify({
            'predictions': results,
            'message': 'Batch prediction successful'
        })
        
    except Exception as e:
        print(f"Batch prediction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/update', methods=['POST'])
def update_and_retrain():
    """Update dataset and retrain model"""
    global model, scaler
    try:
        data = request.get_json()
        
        # Handle different request formats
        records = None
        if 'records' in data:
            records = data['records']
        elif 'newData' in data:
            records = data['newData']
        else:
            # Try to use the entire data as records array
            records = data if isinstance(data, list) else None
        
        if not records or not isinstance(records, list):
            return jsonify({'error': 'Invalid records array. Expected {records: [...]}'}), 400
        
        if len(records) == 0:
            return jsonify({'error': 'Empty records array'}), 400
        
        # Convert new data to DataFrame
        df_new = pd.DataFrame(records)
        
        # Map column names (handle both naming conventions)
        column_mapping = {
            'hour': 'Hour',
            'weight_kg': 'Weight_kg',
            'distance_cm': 'Distance_cm',
            'is_weekend': 'Is_Weekend',
            'overflow_status': 'Overflow_Status',
            'weight': 'Weight_kg',
            'distance': 'Distance_cm',
            'weekend': 'Is_Weekend',
            'status': 'Overflow_Status'
        }
        
        # Rename columns if they exist
        for old_name, new_name in column_mapping.items():
            if old_name in df_new.columns and new_name not in df_new.columns:
                df_new = df_new.rename(columns={old_name: new_name})
        
        # Check required columns
        required_cols = ['Hour', 'Weight_kg', 'Distance_cm', 'Is_Weekend', 'Overflow_Status']
        missing_cols = [col for col in required_cols if col not in df_new.columns]
        
        if missing_cols:
            return jsonify({
                'error': f'Missing required columns: {missing_cols}',
                'available_columns': list(df_new.columns)
            }), 400
        
        # Load existing data if file exists
        if os.path.exists(DATA_PATH):
            df_existing = pd.read_csv(DATA_PATH)
            df_combined = pd.concat([df_existing, df_new], ignore_index=True)
            print(f"Appended {len(df_new)} new records to existing {len(df_existing)} records")
        else:
            df_combined = df_new
            print(f"Created new dataset with {len(df_new)} records")
        
        # Save combined data
        df_combined.to_csv(DATA_PATH, index=False)
        
        # Retrain model
        model, scaler, msg = retrain_model()
        
        if model is None:
            return jsonify({'error': msg}), 500
        
        return jsonify({
            'success': True,
            'message': msg,
            'total_samples': len(df_combined),
            'new_samples': len(df_new),
            'columns': list(df_combined.columns)
        })
        
    except Exception as e:
        print(f"Update error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    
@app.route('/stats', methods=['GET'])
def get_stats():
    """Get model statistics"""
    try:
        if not os.path.exists(DATA_PATH):
            return jsonify({'error': 'No data file found'}), 404
        
        df = pd.read_csv(DATA_PATH)
        
        stats = {
            'total_samples': len(df),
            'features': ['Hour', 'Weight_kg', 'Distance_cm', 'Is_Weekend'],
            'classes': [0, 1, 2],
            'class_distribution': df['Overflow_Status'].value_counts().to_dict() if 'Overflow_Status' in df.columns else {},
            'last_updated': datetime.fromtimestamp(os.path.getmtime(DATA_PATH)).isoformat()
        }
        
        return jsonify(stats)
        
    except Exception as e:
        print(f"Stats error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Copy model files to current directory if they exist in parent
    import shutil
    parent_model = '../garbage_model.pkl'
    parent_scaler = '../scaler.pkl'
    parent_data = '../real_world_garbage_data (1).csv'
    
    if os.path.exists(parent_model) and not os.path.exists(MODEL_PATH):
        shutil.copy(parent_model, MODEL_PATH)
    if os.path.exists(parent_scaler) and not os.path.exists(SCALER_PATH):
        shutil.copy(parent_scaler, SCALER_PATH)
    if os.path.exists(parent_data) and not os.path.exists(DATA_PATH):
        shutil.copy(parent_data, DATA_PATH)
    
    # Load or train model
    if not load_model():
        print("Attempting to train model with existing data...")
        model, scaler, msg = retrain_model()
        if model is None:
            print(f"Warning: {msg}")
            print("Running in demo mode with fallback predictions")
    
    app.run(host='0.0.0.0', port=5001, debug=True)