import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { usersData, apiKey } = await req.json();
    
    if (!usersData || !Array.isArray(usersData) || usersData.length === 0) {
      return NextResponse.json({ error: "Data pengguna tidak valid" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ 
        analysis: "MOHON PERHATIAN: Silakan masukkan Gemini API Key Anda pada kolom input di atas untuk mengaktifkan Analisa AI secara nyata." 
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ analysis: text });
  } catch (error) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: "Gagal menghasilkan analisa. Pastikan API key valid." }, { status: 500 });
  }
}
