// One client for every provider that speaks the OpenAI chat-completions shape with JSON-schema structured output:
// Azure OpenAI (deployment + api-version + api-key header), OpenAI, Mistral, or any compatible endpoint.
// Temperature 0, strict schema, the raw payload returned for the audit. No SDK: one fetch.

export function createLlm(env = process.env) {
  const provider = (env.LLM_PROVIDER || "none").toLowerCase();
  if (provider === "none" || !env.LLM_API_KEY || env.LLM_API_KEY === "unset") return null;
  const model = env.LLM_MODEL || "gpt-4.1-mini";
  const timeoutMs = Number(env.LLM_TIMEOUT_MS || 20000);

  function endpoint() {
    if (provider === "azure") {
      const base = (env.LLM_ENDPOINT || "").replace(/\/$/, "");
      return { url: `${base}/openai/deployments/${encodeURIComponent(model)}/chat/completions?api-version=${env.LLM_API_VERSION || "2024-10-21"}`, headers: { "api-key": env.LLM_API_KEY } };
    }
    const base = (env.LLM_ENDPOINT || (provider === "mistral" ? "https://api.mistral.ai/v1" : "https://api.openai.com/v1")).replace(/\/$/, "");
    return { url: `${base}/chat/completions`, headers: { authorization: `Bearer ${env.LLM_API_KEY}` } };
  }

  async function complete({ system, user, schema, name = "answer", maxTokens = 900 }) {
    const { url, headers } = endpoint();
    const body = {
      model: provider === "azure" ? undefined : model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0,
      max_tokens: maxTokens,
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }
    };
    const t0 = Date.now();
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
    const text = await res.text();
    if (!res.ok) throw new Error(`${provider} ${res.status}: ${text.slice(0, 300)}`);
    const payload = JSON.parse(text);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${provider}: empty content (finish_reason ${payload.choices?.[0]?.finish_reason})`);
    let json;
    try { json = JSON.parse(content); } catch (e) { throw new Error(`${provider}: content is not JSON: ${content.slice(0, 200)}`); }
    return { json, usage: payload.usage || null, model: payload.model || model, ms: Date.now() - t0, raw: payload };
  }

  return { provider, model, complete };
}
