import Groq from "groq-sdk";
import * as dotenv from "dotenv";
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "user",
        content: "You are a freelancer agent. A client wants a 50-word summary of blockchain technology. Write it."
      }
    ],
    max_tokens: 200
  });

  console.log("Groq response:");
  console.log(response.choices[0].message.content);
}

main().catch(console.error);