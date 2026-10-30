import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const expectedPassword = process.env.ADMIN_PASSWORD || "change_me_in_production";

    if (password === expectedPassword) {
      const response = NextResponse.json({ success: true, message: "Admin authenticated" });
      response.cookies.set("admin_session", "authenticated", {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24, // 24 hours
      });
      return response;
    }

    return NextResponse.json({ success: false, error: "Incorrect admin password" }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

