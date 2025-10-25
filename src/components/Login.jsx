import React, { useState } from "react";
import { supabase } from "../services/supabase";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Helper: ensure user exists in custom table
  const ensureUserInTable = async (user) => {
    if (!user) return;
    const { error } = await supabase
      .from("users")
      .upsert([{ id: user.id, email: user.email }], { onConflict: ["id"] });
    if (error) console.error("Failed to insert/update user:", error.message);
  };

 // Sign up new user
const handleSignUp = async () => {
  setLoading(true);
  try {
    // First, check if user already exists in custom users table
    const { data: existingUsers, error: checkError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email);

    if (checkError) throw checkError;

    if (existingUsers && existingUsers.length > 0) {
      // User already exists — try signing them in instead
      alert("User already exists, signing you in...");
      setLoading(false);
      return await handleSignIn(); // Call sign-in instead of creating duplicate
    }

    // Proceed with Supabase Auth signup
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    const user = data.user;
    if (!user) throw new Error("User creation failed");

    // Insert into users table for foreign key use
    await ensureUserInTable(user);

    onLogin(user.id);
  } catch (err) {
    alert("Sign-up failed: " + err.message);
  } finally {
    setLoading(false);
  }
};

  // Sign in existing user
  const handleSignIn = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const user = data.user;
      if (!user) throw new Error("Sign-in failed");

      await ensureUserInTable(user);
      onLogin(user.id);
    } catch (err) {
      alert("Sign-in failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Sign In / Sign Up</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <div style={{ marginTop: "10px" }}>
        <button onClick={handleSignIn} disabled={loading}>
          {loading ? "Signing In..." : "Sign In"}
        </button>
        <button onClick={handleSignUp} disabled={loading}>
          {loading ? "Signing Up..." : "Sign Up"}
        </button>
      </div>
    </div>
  );
}
