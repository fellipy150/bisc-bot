const readline = require("readline");

function perguntarLink() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question("Cole o link do tweet (pode ser de domínio alternativo): ", (input) => {
      rl.close();
      resolve(input.trim());
    });
  });
}

function limparLink(link) {
  try {
    const url = new URL(link);
    const [, user, status, id] = url.pathname.split("/");
    if (!user || status !== "status" || !id) throw new Error();
    return `https://twitter.com/${user}/status/${id}`;
  } catch {
    return null;
  }
}

async function buscarVideoEmTwdown(tweetUrl) {
  const searchParams = new URLSearchParams();
  searchParams.append("URL", tweetUrl);

  const response = await fetch("https://twdown.net/download.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0"
    },
    body: searchParams.toString()
  });

  const html = await response.text();

  const match = html.match(/https:\/\/[^"']+\.mp4[^"']*/);
  return match ? match[0] : null;
}

async function main() {
  const input = await perguntarLink();
  const urlFinal = limparLink(input);

  if (!urlFinal) {
    console.log("URL inválida.");
    return;
  }

  console.log("URL final analisada:", urlFinal);
  console.log("Buscando vídeo em twdown.net...");

  try {
    const mp4 = await buscarVideoEmTwdown(urlFinal);
    if (mp4) {
      console.log("Vídeo encontrado:");
      console.log(mp4);
    } else {
      console.log("Nenhum vídeo encontrado.");
    }
  } catch (err) {
    console.error("Erro ao buscar vídeo:", err.message);
  }
}

main();
