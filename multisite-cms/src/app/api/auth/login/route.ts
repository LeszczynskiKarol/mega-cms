import { login } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Logowanie raw body
    const text = await request.text();
    console.log("Raw body:", text);

    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      console.log("JSON parse error:", e);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    console.log("Parsed body:", body);

    const { email, password } = body || {};

    console.log("Email:", email, "Password:", password ? "***" : "empty");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email i hasło są wymagane" },
        { status: 400 }
      );
    }

    const result = await login(email, password);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd serwera" },
      { status: 500 }
    );
  }
}
