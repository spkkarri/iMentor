from typing import Dict, List

class ModelStatus:
    def __init__(self):
        self.model_status: Dict[str, bool] = {}

    def update_model_status(self, model_name: str, is_available: bool) -> None:
        self.model_status[model_name] = is_available

    def get_available_models(self) -> List[str]:
        return [model for model, available in self.model_status.items() if available]

    def is_model_available(self, model_name: str) -> bool:
        return self.model_status.get(model_name, False)