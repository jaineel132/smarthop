import joblib
import os

MODELS_DIR = r"c:\Users\Jaineel\OneDrive\Desktop\Smarthop_C\ml-service\ml\models"
scaler_path = os.path.join(MODELS_DIR, "fare_scaler.joblib")

if os.path.exists(scaler_path):
    scaler = joblib.load(scaler_path)
    print(f"Scaler features in: {scaler.n_features_in_}")
    if hasattr(scaler, "feature_names_in_"):
        print(f"Feature names: {scaler.feature_names_in_}")
else:
    print("Scaler not found")
