const axios = require('axios');

function boundedNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function realtimeMaxOutputTokens(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'inf' || normalized === 'infinity') return 'inf';
  return Math.round(boundedNumber(value, 1200, 256, 4096));
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

class OpenAIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseURL = 'https://api.openai.com/v1';

    if (!this.apiKey) {
      console.warn('OpenAI API key not found. Chat functionality will be limited.');
    }
  }

  async generateChatResponse(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const startTime = Date.now();

    try {
      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: options.model || 'gpt-4o', // Upgraded from gpt-3.5-turbo for superior understanding
        messages: messages,
        temperature: options.temperature || 0.5, // Lower temperature for consistent, focused responses
        max_completion_tokens: options.max_completion_tokens || 1000,
        top_p: options.top_p || 1,
        frequency_penalty: options.frequency_penalty || 0,
        presence_penalty: options.presence_penalty || 0,
        stream: false
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(process.env.OPENAI_PROJECT_ID ? { 'OpenAI-Project': process.env.OPENAI_PROJECT_ID } : {})
        },
        timeout: 30000 // 30 second timeout
      });

      const processingTime = Date.now() - startTime;

      return {
        content: response.data.choices[0].message.content,
        finishReason: response.data.choices[0].finish_reason,
        usage: response.data.usage,
        processingTime: processingTime,
        model: response.data.model
      };

    } catch (error) {
      console.error('OpenAI API error:', error.response?.data || error.message);

      if (error.response?.status === 429) {
        const apiError = error.response?.data?.error;
        if (apiError?.code === 'insufficient_quota') {
          throw {
            code: 'OPENAI_QUOTA_EXCEEDED',
            message:
              'OpenAI quota exceeded. Add billing credits at platform.openai.com or set a new OPENAI_API_KEY in the server .env file.'
          };
        }
        const retryAfter = error.response.headers['retry-after'];
        throw {
          code: 'OPENAI_RATE_LIMIT',
          message: `Rate limit exceeded. Try again in ${retryAfter || 60} seconds.`,
          retryAfter: retryAfter
        };
      }

      if (error.response?.status === 401) {
        throw {
          code: 'OPENAI_AUTH_ERROR',
          message: 'OpenAI API authentication failed. Please check your API key.'
        };
      }

      if (error.code === 'ECONNABORTED' || error.code === 'TIMEOUT') {
        throw {
          code: 'OPENAI_TIMEOUT',
          message: 'OpenAI API request timed out. Please try again.'
        };
      }

      throw {
        code: 'OPENAI_ERROR',
        message: error.response?.data?.error?.message || 'OpenAI API request failed',
        details: error.response?.data
      };
    }
  }

  async generateEmbedding(text, model = 'text-embedding-3-small') {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await axios.post(`${this.baseURL}/embeddings`, {
        model: model,
        input: text
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(process.env.OPENAI_PROJECT_ID ? { 'OpenAI-Project': process.env.OPENAI_PROJECT_ID } : {})
        },
        timeout: 30000
      });

      return {
        embedding: response.data.data[0].embedding,
        usage: response.data.usage,
        model: response.data.model
      };

    } catch (error) {
      console.error('OpenAI Embedding API error:', error.response?.data || error.message);
      throw {
        code: 'OPENAI_EMBEDDING_ERROR',
        message: error.response?.data?.error?.message || 'OpenAI Embedding API request failed'
      };
    }
  }

  // Health check for OpenAI API
  async healthCheck() {
    if (!this.apiKey) {
      return { status: 'error', message: 'API key not configured' };
    }

    try {
      // Simple test with minimal tokens
      await this.generateChatResponse([
        { role: 'user', content: 'Hi' }
      ], { max_tokens: 5 });

      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'error',
        message: error.message || 'Health check failed'
      };
    }
  }

  // Estimate tokens (rough estimation)
  estimateTokens(text) {
    // Very rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  // Validate conversation context length
  validateContextLength(messages, model = 'gpt-3.5-turbo') {
    const modelLimits = {
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384,
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-5.1': 128000
    };

    const limit = modelLimits[model] || 4096;
    const totalTokens = messages.reduce((total, msg) => {
      return total + this.estimateTokens(msg.content || '');
    }, 0);

    return {
      isValid: totalTokens < limit * 0.8, // Use 80% of limit for safety
      totalTokens,
      limit,
      percentage: (totalTokens / limit) * 100
    };
  }
  async generateSpeech(text, voice = 'onyx') {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await axios.post(`${this.baseURL}/audio/speech`, {
        model: 'tts-1',
        voice: voice,
        input: text
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer' // Important for audio data
      });

      return response.data;

    } catch (error) {
      throw {
        code: 'OPENAI_TTS_ERROR',
        message: 'OpenAI Text-to-Speech request failed'
      };
    }
  }

  async transcribeAudio(fileBuffer, fileName = 'audio.webm', language = 'ro') {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', fileBuffer, fileName);
      form.append('model', 'whisper-1');
      form.append('language', language); // Set language to Romanian by default

      const response = await axios.post(`${this.baseURL}/audio/transcriptions`, form, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...form.getHeaders()
        },
        timeout: 60000 // Increased timeout to 60s for Whisper API
      });

      return response.data.text;
    } catch (error) {
      console.error('OpenAI Whisper API error:', error.response?.data || error.message);
      throw {
        code: 'OPENAI_WHISPER_ERROR',
        message: 'Speech-to-text transcription failed',
        details: error.response?.data
      };
    }
  }

  async createLiveSession({
    sdp,
    instructions,
    voice = null,
    input = []
  }) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const session = {
        model: process.env.OPENAI_LIVE_MODEL || 'gpt-live-1',
        instructions,
        audio: {
          output: {
            voice: voice || process.env.OPENAI_LIVE_VOICE || 'marin'
          }
        },
        input,
        store: false,
        client: {
          data_channel: {
            allowed_client_events: [
              'session.input_audio.mute',
              'session.input_audio.unmute',
              'session.close'
            ],
            allowed_server_events: [
              { type: 'session.started' },
              { type: 'session.closed' },
              { type: 'session.input_audio.muted' },
              { type: 'session.input_audio.unmuted' },
              { type: 'session.input_transcript.delta' },
              { type: 'session.output_transcript.delta' },
              { type: 'session.delegation.created' },
              { type: 'session.usage.updated' },
              { type: 'info' },
              { type: 'error' }
            ]
          }
        }
      };

      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };
      const projectId = process.env.OPENAI_PROJECT_ID || this.apiProject;
      if (projectId) {
        headers['OpenAI-Project'] = projectId;
      }

      const response = await axios.post(`${this.baseURL}/live/sessions`, {
        session,
        transport: {
          type: 'webrtc',
          sdp
        }
      }, {
        headers,
        timeout: 20000
      });

      return response.data;
    } catch (error) {
      console.error('OpenAI Live session error:', error.response?.data || error.message);
      throw {
        code: 'OPENAI_LIVE_ERROR',
        status: error.response?.status || 502,
        message: error.response?.data?.error?.message || 'Failed to create OpenAI Live session'
      };
    }
  }

  async createRealtimeSession({
    sdp,
    instructions,
    voice = null
  }) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (typeof sdp !== 'string' || !sdp.trim() || !sdp.trimStart().startsWith('v=0')) {
      throw {
        code: 'OPENAI_REALTIME_ERROR',
        status: 400,
        message: 'Browserul nu a generat o ofertă audio WebRTC validă.'
      };
    }

    try {
      const session = this.buildRealtimeSessionConfig(instructions, voice);
      // Browser SDP offers normally end with CRLF. Preserve that terminator
      // because removing it can make the SDP parser reach EOF mid-record.
      const normalizedSdp = sdp.endsWith('\r\n')
        ? sdp
        : `${sdp.trimEnd()}\r\n`;
      const boundary = `----paviagen-${require('crypto').randomBytes(18).toString('hex')}`;
      const multipartBody = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\n` +
          'Content-Disposition: form-data; name="sdp"\r\n' +
          'Content-Type: application/sdp\r\n\r\n',
          'utf8'
        ),
        Buffer.from(normalizedSdp, 'utf8'),
        Buffer.from(
          `\r\n--${boundary}\r\n` +
          'Content-Disposition: form-data; name="session"\r\n' +
          'Content-Type: application/json\r\n\r\n',
          'utf8'
        ),
        Buffer.from(JSON.stringify(session), 'utf8'),
        Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
      ]);

      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(multipartBody.byteLength)
      };
      const projectId = process.env.OPENAI_PROJECT_ID || this.apiProject;
      if (projectId) {
        headers['OpenAI-Project'] = projectId;
      }

      const response = await fetch(`${this.baseURL}/realtime/calls`, {
        method: 'POST',
        headers: {
          ...headers
        },
        body: multipartBody,
        signal: AbortSignal.timeout(20000)
      });

      const responseText = await response.text();
      if (!response.ok) {
        let responseData = responseText;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          // Keep plain-text OpenAI errors unchanged.
        }

        throw {
          code: 'OPENAI_REALTIME_ERROR',
          status: response.status,
          message: responseData?.error?.message ||
            responseData?.error ||
            (typeof responseData === 'string' && responseData.trim()
              ? responseData
              : 'Failed to create OpenAI Realtime session')
        };
      }

      const location = response.headers.get('location') || '';
      const callId = location.split('/').filter(Boolean).pop() || `realtime-${Date.now()}`;
      return {
        mode: 'realtime',
        session: { id: callId },
        transport: { type: 'webrtc', sdp: responseText },
        voiceConfig: {
          model: session.model,
          voice: session.audio.output.voice,
          turnDetection: session.audio.input.turn_detection
        }
      };
    } catch (error) {
      if (error?.code === 'OPENAI_REALTIME_ERROR') {
        console.error('OpenAI Realtime session error:', error.message);
        throw error;
      }

      console.error('OpenAI Realtime session error:', error.response?.data || error.message);
      let responseData = error.response?.data;
      if (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData);
        } catch {
          // Keep the original response text for the fallback message below.
        }
      }
      throw {
        code: 'OPENAI_REALTIME_ERROR',
        status: error.response?.status || 502,
        message: responseData?.error?.message ||
          responseData?.error ||
          (typeof responseData === 'string' ? responseData : null) ||
          'Failed to create OpenAI Realtime session'
      };
    }
  }

  selectVoiceForGender(gender, mode = 'realtime') {
    const normalizedGender = String(gender || '')
      .trim()
      .toLowerCase();
    const isFemale = ['female', 'femeie', 'feminin', 'f'].includes(normalizedGender);
    const isMale = ['male', 'barbat', 'bărbat', 'masculin', 'm'].includes(normalizedGender);
    const envPrefix = mode === 'live' ? 'OPENAI_LIVE_VOICE' : 'OPENAI_REALTIME_VOICE';

    if (isFemale) {
      return nonEmptyString(process.env[`${envPrefix}_FEMALE`]) || 'marin';
    }
    if (isMale) {
      return nonEmptyString(process.env[`${envPrefix}_MALE`]) || 'cedar';
    }

    return nonEmptyString(process.env[envPrefix]) || 'marin';
  }

  buildRealtimeSessionConfig(instructions, voice = null) {
    const requestedVadMode = String(process.env.OPENAI_VAD_MODE || 'semantic')
      .trim()
      .toLowerCase();
    const configuredEagerness = String(process.env.OPENAI_VAD_EAGERNESS || '')
      .trim()
      .toLowerCase();
    const turnDetection = requestedVadMode === 'server'
      ? {
          type: 'server_vad',
          threshold: boundedNumber(
            process.env.OPENAI_VAD_THRESHOLD,
            0.5,
            0.1,
            0.9
          ),
          prefix_padding_ms: 300,
          silence_duration_ms: boundedNumber(
            process.env.OPENAI_VAD_SILENCE_MS,
            450,
            200,
            1200
          ),
          create_response: true,
          interrupt_response: true
        }
      : {
          type: 'semantic_vad',
          eagerness: ['low', 'medium', 'high', 'auto'].includes(configuredEagerness)
            ? configuredEagerness
            : 'medium',
          create_response: true,
          interrupt_response: true
        };

    return {
      type: 'realtime',
      model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1',
      output_modalities: ['audio'],
      instructions,
      // Audio responses consume output tokens much faster than plain text.
      // A very small ceiling cuts speech mid-word; the prompt, not this safety
      // ceiling, should keep ordinary patient replies concise.
      max_output_tokens: realtimeMaxOutputTokens(
        process.env.OPENAI_REALTIME_MAX_OUTPUT_TOKENS
      ),
      audio: {
        input: {
          noise_reduction: { type: 'near_field' },
          transcription: {
            model: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
            language: 'ro'
          },
          turn_detection: turnDetection
        },
        output: {
          voice: voice || process.env.OPENAI_REALTIME_VOICE || 'marin'
        }
      }
    };
  }
}

module.exports = new OpenAIService();
