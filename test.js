import 'dotenv/config';

async function checkModels() {
  console.log("Đang gõ cửa Google để lấy danh sách Model...");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
  const data = await response.json();
  
  if (data.error) {
    console.error("Lỗi:", data.error.message);
    return;
  }

  console.log("\n🎉 DANH SÁCH TÊN MODEL CHUẨN XÁC DÀNH CHO BẠN:");
  const validModels = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
  validModels.forEach(m => {
    console.log(`👉 ${m.name.replace('models/', '')}`);
  });
}

checkModels();