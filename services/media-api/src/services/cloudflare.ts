import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const STREAM_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`;

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  throw new Error('Missing Cloudflare Stream credentials');
}

interface DirectUploadResponse {
  result: {
    uid: string;  // Cloudflare uses 'uid' not 'id'
    uploadURL: string;
  };
  success: boolean;
}

interface VideoResponse {
  result: {
    uid: string;
    status: {
      state: string;
    };
    playback: {
      hls: string;
      dash: string;
    };
    thumbnail: string;
    preview: string;
    duration: number;
  };
  success: boolean;
}

export async function createDirectUploadUrl() {
  try {
    const response = await fetch(`${STREAM_API_BASE}/direct_upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        maxDurationSeconds: 60, // 1 minute max for short clips
        allowedOrigins: ['*'], // In production, restrict to your domain
      }),
    });

    const data = await response.json() as DirectUploadResponse;
    
    console.log('[Cloudflare] API Response status:', response.status);
    console.log('[Cloudflare] API Response data:', JSON.stringify(data, null, 2));
    
    if (!data.success) {
      console.error('Cloudflare API error:', data);
      throw new Error('Failed to create upload URL');
    }

    if (!data.result || !data.result.uid || !data.result.uploadURL) {
      console.error('Invalid Cloudflare response:', data);
      throw new Error('Invalid upload URL response from Cloudflare');
    }
    
    console.log('[Cloudflare] Created upload URL for video ID:', data.result.uid);
    
    return {
      id: data.result.uid,  // Use 'uid' from API response
      uploadURL: data.result.uploadURL,
    };
  } catch (error) {
    console.error('Error creating upload URL:', error);
    throw error;
  }
}

export async function getVideo(videoId: string) {
  try {
    const response = await fetch(`${STREAM_API_BASE}/${videoId}`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });

    // Check HTTP status before parsing JSON
    if (response.status === 404) {
      const error: any = new Error('Video not found (404)');
      error.statusCode = 404;
      throw error;
    }

    if (!response.ok) {
      const error: any = new Error(`Cloudflare API error: ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }

    const data = await response.json() as VideoResponse;
    
    if (!data.success) {
      throw new Error('Failed to fetch video');
    }

    return {
      uid: data.result.uid,
      status: data.result.status.state,
      playback: {
        hls: data.result.playback.hls,
        dash: data.result.playback.dash,
      },
      thumbnail: data.result.thumbnail || data.result.preview,
      duration: data.result.duration,
    };
  } catch (error) {
    console.error('Error fetching video:', error);
    throw error;
  }
}

