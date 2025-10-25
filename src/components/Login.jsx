import React, { useState } from "react";
import { supabase } from "../services/supabase";
import "../styles/Login.css";

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
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2 className="login-title">Munch Match</h2>
        </div>
        
        <div className="login-form">
          <input
            className="login-input"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            className="login-input"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          
          <div className="login-button-group">
            <button 
              className="login-button login-button-primary"
              onClick={handleSignIn} 
              disabled={loading}
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
            <button 
              className="login-button login-button-secondary"
              onClick={handleSignUp} 
              disabled={loading}
            >
              {loading ? "Signing Up..." : "Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}