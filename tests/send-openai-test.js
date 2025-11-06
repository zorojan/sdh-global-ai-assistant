(async () => {
  const API = 'http://localhost:3001/api/agents/chat';
  const payload = {
    message: 'Hello from OpenAI test script',
    agentId: 'default',
    provider: 'openai'
  };

  try {
    console.log('Sending OpenAI test message to', API);
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log('HTTP', res.status, res.statusText);
    try { console.log('Response JSON:', JSON.parse(text)); } catch { console.log('Response text:', text); }
  } catch (err) {
    console.error('Error sending OpenAI test:', err);
    process.exit(1);
  }
})();
