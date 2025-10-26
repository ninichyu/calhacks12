import React, { useState } from "react";
import { supabase } from "../services/supabase";
import "../styles/Login.css";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

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

  const handleAuth = async () => {
    if (isSignUp) {
      await handleSignUp();
    } else {
      await handleSignIn();
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Munch Match</h2>
          <p>{isSignUp ? "Create your account" : "Sign in to start swiping"}</p>
        </div>

        <div className="login-form">
          <div className="input-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="login-input"
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="login-input"
              disabled={loading}
            />
          </div>

          <button
            onClick={handleAuth}
            className="login-button"
            disabled={loading || !email || !password}
          >
            {loading ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
                Processing...
              </div>
            ) : (
              isSignUp ? "Create Account" : "Sign In"
            )}
          </button>

          <div className="login-divider">
            <span>or</span>
          </div>

          <div className="toggle-section">
            <p>
              {isSignUp ? "Already have an account?" : "Don't have an account?"}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="toggle-button"
                disabled={loading}
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}