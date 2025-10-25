import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ssodzocvvyhzhuisaqtg.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzb2R6b2N2dnloemh1aXNhcXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNTEwMDAsImV4cCI6MjA3NjkyNzAwMH0.WXRufKrFgt4kLqPzpKPx4w44cO0IsxFu6xtdLDQELHw";
export const supabase = createClient(supabaseUrl, supabaseKey);

// Sign up
export const signUp = async (email, password) =>
  await supabase.auth.signUp({ email, password });

// Sign in
export const signIn = async (email, password) =>
  await supabase.auth.signInWithPassword({ email, password });

// Get current user
export const getUser = () => supabase.auth.getUser();
