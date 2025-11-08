from typing import Optional

from .local_agent import LocalLiveAgent


class LiveVoiceAgentFactory:
    @staticmethod
    def get_agent(provider: Optional[str] = None):
        # provider can be 'local' (default), 'gemini', 'openai', etc.
        if not provider or provider == "local":
            return LocalLiveAgent()
        # future: map provider names to concrete implementations
        return LocalLiveAgent()
