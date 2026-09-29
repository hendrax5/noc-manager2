import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAppConfig } from "@/lib/config";
import { canViewAllPerformance } from "@/lib/reports/performanceAccess";

interface MetricParams {
  finalScore: number;
  resolvedCount: number;
  totalInvolvedCount: number;
  totalComments: number;
}

interface UserDataPayload {
  user: {
    name: string;
    department: string;
  };
  metrics: MetricParams;
}

const MAX_USERS = 20;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canViewAllPerformance(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const usersData = body.usersData as UserDataPayload[];
    
    if (!usersData || !Array.isArray(usersData) || usersData.length === 0 || usersData.length > MAX_USERS) {
      return NextResponse.json({ error: "Data pengguna tidak valid" }, { status: 400 });
    }

    const config = await getAppConfig();
    const resolvedApiKey = process.env.GEMINI_API_KEY || config.geminiApiKey;

    if (!resolvedApiKey) {
      return NextResponse.json({ 
        analysis: "MOHON PERHATIAN: Admin belum mengkonfigurasi Gemini API Key di menu Settings > Team Preferences. Fitur AI saat ini belum dapat digunakan." 
      });
    }

    const genAI = new GoogleGenerativeAI(resolvedApiKey);

    // Buat rangkuman string untuk Gemini agar tidak kebesaran payload (hanya ambil data esensial)
    const summarizedData = usersData.map(u => ({
      name: u.user.name,
      department: u.user.department,
      score: u.metrics.finalScore,
      resolved: u.metrics.resolvedCount,
      involved: u.metrics.totalInvolvedCount,
      comments: u.metrics.totalComments
    }));

    const prompt = `Anda adalah analis performa tim NOC yang cerdas dan suportif. 
Tugas Anda adalah membandingkan performa anggota tim berdasarkan data berikut:
${JSON.stringify(summarizedData)}

Buatlah analisa deskriptif singkat (maksimal 2 paragraf padat).
Jelaskan KENAPA seseorang (yang skornya tertinggi) bisa memiliki skor kumulatif yang paling tinggi jika dilihat dari perbandingan metrik 'resolved', 'involved', dan 'comments'-nya terhadap yang lain. 
Soroti juga kontribusi anggota lainnya secara positif.
Gunakan nada profesional namun santai (menggunakan bahasa Indonesia). Jangan tampilkan format JSON di output, cukup teks narasinya.`;

    const modelId = config.geminiModel || "gemini-1.5-flash";
    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ analysis: text });
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: "AI Error: Terjadi kesalahan internal" }, { status: 500 });
  }
}
