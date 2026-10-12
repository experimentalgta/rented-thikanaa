// ========================================================================
// Supabase Edge Function: send-push
// Production-Ready Web Push Notification Dispatcher for Renter Thikan
// ========================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY =
  Deno.env.get("VAPID_PUBLIC_KEY") ||
  "BJ469rJuWoOpUv6iKczWBxZF3WHvSXK6aRuiVUHWaM_Hzb6S2P5THqE202GtOGUMnpeaOAZJoMqh8Rp7RYBk7-o";

const VAPID_PRIVATE_KEY =
  Deno.env.get("VAPID_PRIVATE_KEY") ||
  "s9LroyJOS2Ewq4R3Ed1BCrmlxxIvjolXW6PTZlm2XaY";

const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") || "mailto:support@renterthikan.com";

// Configure web-push with VAPID details
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) {
  console.warn("[send-push] VAPID configuration warning:", e);
}

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    // 2. Validate Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Client for auth token verification
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await authClient.auth.getUser();

    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized user session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Elevated client for reading push subscriptions and pruning dead endpoints
    const adminClient = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

    const body = await req.json();
    const { messageId, conversationId, senderId, receiverId, senderName, text } = body;

    // 3. Security Check: Caller must be the sender
    if (user.id !== senderId) {
      return new Response(
        JSON.stringify({ error: "Sender ID mismatch with authenticated identity" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!receiverId || !conversationId) {
      return new Response(
        JSON.stringify({ error: "Missing required conversation or recipient parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Verify message actually exists in database to prevent arbitrary push spoofing
    if (messageId) {
      const { data: verifiedMsg } = await adminClient
        .from("messages")
        .select("id, sender_id, receiver_id, conversation_id")
        .eq("id", messageId)
        .maybeSingle();

      if (!verifiedMsg || verifiedMsg.sender_id !== user.id || verifiedMsg.receiver_id !== receiverId) {
        return new Response(
          JSON.stringify({ error: "Message verification failed" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 5. Query recipient's active push subscriptions
    const { data: subscriptions, error: subErr } = await adminClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", receiverId);

    if (subErr || !subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active push subscriptions registered for recipient",
          sent: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Build privacy-safe notification payload (no sensitive PII)
    const displayName = senderName && senderName !== "User" ? senderName : "A member";
    const notificationPayload = JSON.stringify({
      title: "New message on Renter Thikan",
      body: `New message from ${displayName}`,
      icon: "/pwa-192x192.png",
      badge: "/favicon-32x32.png",
      tag: `msg-${conversationId}`,
      data: {
        conversationId,
        messageId,
        url: `/?view=messages&conv=${conversationId}`,
      },
    });

    // 7. Dispatch push to all recipient devices
    let sentCount = 0;
    let failedCount = 0;
    const deadSubscriptionIds: string[] = [];

    const sendPromises = subscriptions.map(async (sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushConfig, notificationPayload, {
          TTL: 60 * 60 * 24, // 24 hours retention
          urgency: "high",
        });
        sentCount++;
      } catch (err: any) {
        failedCount++;
        // If HTTP 404 or 410, push service revoked the subscription
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          deadSubscriptionIds.push(sub.id);
        } else {
          console.warn("[send-push] Transient push error for endpoint:", err?.statusCode || err?.message);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    // 8. Auto-prune dead/expired subscriptions
    if (deadSubscriptionIds.length > 0) {
      try {
        await adminClient
          .from("push_subscriptions")
          .delete()
          .in("id", deadSubscriptionIds);
      } catch (pruneErr) {
        console.warn("[send-push] Failed to prune dead subscriptions:", pruneErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        pruned: deadSubscriptionIds.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-push] Top-level handler exception:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
