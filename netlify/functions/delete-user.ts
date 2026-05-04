import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

interface RateLimit {
  minute: number;
  minuteReset: number;
}
const rateLimits = new Map<string, RateLimit>();

export const handler: Handler = async (event, context) => {
  const requestId = randomUUID();
  const timestamp = new Date().toISOString();
  const ip = event.headers["x-forwarded-for"] || event.headers["client-ip"] || "unknown";

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: "Method Not Allowed", requestId, timestamp }),
    };
  }

  const now = Date.now();
  let limit = rateLimits.get(ip);
  if (!limit) {
    limit = { minute: 0, minuteReset: now + 60000 };
    rateLimits.set(ip, limit);
  }
  if (now > limit.minuteReset) { limit.minute = 0; limit.minuteReset = now + 60000; }
  limit.minute++;
  
  if (Math.random() < 0.1) {
    for (const [k, v] of rateLimits.entries()) if (now > v.minuteReset) rateLimits.delete(k);
  }

  if (limit.minute > 10) {
    return {
      statusCode: 429,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: "Rate limit exceeded", requestId, timestamp }),
    };
  }

  try {
    const contentType = event.headers["content-type"] || "";
    if (!contentType.includes("application/json")) {
       return {
         statusCode: 400,
         headers: corsHeaders,
         body: JSON.stringify({ success: false, error: "Content-Type must be application/json", requestId, timestamp })
       };
    }
    
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
         statusCode: 400,
         headers: corsHeaders,
         body: JSON.stringify({ success: false, error: "Invalid JSON", requestId, timestamp })
      };
    }

    if (!body.confirm) {
      return {
         statusCode: 400,
         headers: corsHeaders,
         body: JSON.stringify({ success: false, error: "Must include confirm: true in request body", requestId, timestamp })
      };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split("Bearer ")[1];
    }
    
    if (!token) {
      console.warn(`[${timestamp}] [${requestId}] Failed delete attempt - missing bearer token (IP: ${ip})`);
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: "Missing or invalid authorization token", requestId, timestamp }),
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
       console.error(`[${timestamp}] [${requestId}] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
       return {
         statusCode: 500,
         headers: corsHeaders,
         body: JSON.stringify({ success: false, error: "Server configuration missing", requestId, timestamp })
       };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
       console.warn(`[${timestamp}] [${requestId}] Invalid token or user not found during deletion (IP: ${ip})`);
       return {
         statusCode: 401,
         headers: corsHeaders,
         body: JSON.stringify({ success: false, error: "Invalid token or user not found", requestId, timestamp })
       };
    }

    console.log(`[${timestamp}] [${requestId}] Authorized user deletion for UID: ${user.id} (IP: ${ip})`);

    const deletionTasks = [
      supabase.from("messages").delete().eq("user_id", user.id).then(res => {
         if (res.error) throw new Error(`Messages sync error: ${res.error.message}`);
         return res;
      }),
      supabase.from("chats").delete().eq("user_id", user.id).then(res => {
         if (res.error) throw new Error(`Chats sync error: ${res.error.message}`);
         return res;
      }),
      supabase.from("profiles").delete().eq("id", user.id).then(res => {
         if (res.error) throw new Error(`Profiles sync error: ${res.error.message}`);
         return res;
      })
    ];

    const results = await Promise.allSettled(deletionTasks);
    const failures = results.filter(r => r.status === "rejected");
    if (failures.length > 0) {
       console.warn(`[${timestamp}] [${requestId}] Non-fatal errors while deleting user data bounds:`, failures.map((f: any) => f.reason?.message));
    }

    const { error: adminError } = await supabase.auth.admin.deleteUser(user.id);
    if (adminError) {
        throw new Error(`Auth Admin deletion failed: ${adminError.message}`);
    }

    console.log(`[${timestamp}] [${requestId}] Successfully completed deletion for UID: ${user.id}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, requestId, timestamp }),
    };
  } catch (error: any) {
    console.error(`[${timestamp}] [${requestId}] Delete user error:`, error.message || error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: "Failed to delete user: " + (error.message || "Unknown error"), requestId, timestamp }),
    };
  }
};
