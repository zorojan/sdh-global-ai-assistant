from typing import Optional

from .local_agent import LocalLiveAgent
try:
    from .gemini_agent import GeminiLiveAgent
except Exception:
    GeminiLiveAgent = None


class LiveVoiceAgentFactory:
    @staticmethod
    def get_agent(provider: Optional[str] = None):
        # provider can be 'local' (default), 'gemini', 'openai', etc.
        if provider == "gemini" and GeminiLiveAgent is not None:
            return GeminiLiveAgent()
        # default to local stub
        return LocalLiveAgent()
