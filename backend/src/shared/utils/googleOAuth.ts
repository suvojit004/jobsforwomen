import crypto from "crypto"
import env from "../config/env"
import { logger } from "./logger"

export interface GoogleProfile {
  id: string
  email: string
  name: string
  picture?: string
}

/**
 * Generates secure state parameter and authorization URI.
 */
export function getGoogleAuthUrl(role: string): { url: string; state: string } {
  const state = crypto.randomBytes(16).toString("hex") + `:${role}`
  
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth"
  const options = {
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    client_id: env.GOOGLE_CLIENT_ID,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    state,
  }

  const qs = new URLSearchParams(options).toString()
  return { url: `${rootUrl}?${qs}`, state }
}

/**
 * Exchanges authorization code for Google user details.
 */
export async function getGoogleUser(code: string): Promise<GoogleProfile> {
  try {
    const tokenUrl = "https://oauth2.googleapis.com/token"
    const values = {
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      grant_type: "authorization_code",
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(values).toString(),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Google token exchange failed: ${errText}`)
    }

    const { id_token, access_token } = (await response.json()) as any

    // Fetch user details from Google UserInfo API
    const userResponse = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?alt=json&access_token=${access_token}`, {
      headers: { Authorization: `Bearer ${id_token}` },
    })

    if (!userResponse.ok) {
      throw new Error("Failed to fetch Google user profile")
    }

    const userProfile = (await userResponse.json()) as any
    return {
      id: userProfile.sub,
      email: userProfile.email,
      name: userProfile.name,
      picture: userProfile.picture,
    }
  } catch (err: any) {
    logger.error(`[GoogleOAuth] Error during OAuth verification: ${err.message}`)
    throw err;
  }
}

export default {
  getGoogleAuthUrl,
  getGoogleUser,
}
