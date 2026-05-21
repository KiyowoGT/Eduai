class UserMessage:
    def __init__(self, text, file_contents=None):
        self.text = text
        self.file_contents = file_contents or []

class FileContentWithMimeType:
    def __init__(self, file_path, mime_type):
        self.file_path = file_path
        self.mime_type = mime_type

class LlmChat:
    def __init__(self, api_key, session_id, system_message):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.model = None

    def with_model(self, provider, model_name):
        self.model = model_name
        return self

    async def send_message(self, message):
        # Mock response based on the prompt
        return "{}"
