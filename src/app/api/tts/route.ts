import { NextRequest, NextResponse } from 'next/server';

  

function normalizeGreekText(text: string): string {
  let normalized = text;
  
  // Replace links with a generic phrase
  // 1. Markdown links: [Link text](url) -> Link text. υπάρχει κατάλληλος σύνδεσμος στην ιστοσελίδα.
  normalized = normalized.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1. Υπάρχει κατάλληλος σύνδεσμος στην ιστοσελίδα.');
  
  // 2. Raw URLs (http/https)
  normalized = normalized.replace(/https?:\/\/[^\s]+/g, 'Υπάρχει κατάλληλος σύνδεσμος στην ιστοσελίδα.');

  // Replace € with 'ευρώ'
  normalized = normalized.replace(/€/g, ' ευρώ');
  
  // Convert long numbers (like phones, AFM, AMKA - 9 to 11 digits) to spoken words, digit by digit
  normalized = normalized.replace(/\b\d{9,11}\b/g, (match) => {
    const digitWords: Record<string, string> = {
      '0': 'μηδέν', '1': 'ένα', '2': 'δύο', '3': 'τρία', '4': 'τέσσερα', 
      '5': 'πέντε', '6': 'έξι', '7': 'επτά', '8': 'οκτώ', '9': 'εννέα'
    };
    return match.split('').map(d => digitWords[d] || d).join(' ');
  });

  // Remove dots from numbers (e.g., 1.500 -> 1500) so ElevenLabs reads them as full numbers correctly
  normalized = normalized.replace(/(\d)\.(\d{3})/g, '$1$2');
  
  // Clean up markdown characters like * and #
  normalized = normalized.replace(/[*#]/g, '');
  
  return normalized;
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Sarah (Female, Mature, Reassuring)

    if (!text) return NextResponse.json({ error: 'Text is required' }, { status: 400 });

    const processedText = normalizeGreekText(text);

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey!,
      },
      body: JSON.stringify({
        text: processedText,
        model_id: 'eleven_turbo_v2_5', // Reverting to Turbo for zero-latency
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.8,
          style: 0.2,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('ElevenLabs API detailed error:', JSON.stringify(err, null, 2));
      throw new Error(err.detail?.message || JSON.stringify(err) || 'ElevenLabs API error');
    }

    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch (error: any) {
    console.error('TTS Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
