const upload = document.getElementById("upload");
const imagesContainer = document.getElementById("images");
const globalCaption = document.getElementById("globalCaption");
const applyAllBtn = document.getElementById("applyAll");
const modal = document.getElementById("modal");
const modalImg = document.getElementById("modalImg");

const imageItems = [];

modal.addEventListener("click", () => {
  modal.classList.remove("open");
});

upload.addEventListener("change", (e) => {
  Array.from(e.target.files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => createImageItem(img, file.name);
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
});

applyAllBtn.addEventListener("click", () => {
  const caption = globalCaption.value;
  imageItems.forEach((item) => {
    item.generate(caption);
  });
});

function createImageItem(img, filename) {
  const item = document.createElement("div");
  item.className = "image-item";

  const leftSection = document.createElement("div");
  leftSection.className = "left-section";

  const rightSection = document.createElement("div");
  rightSection.className = "right-section";

  const title = document.createElement("div");
  title.textContent = filename;
  title.style.fontWeight = "bold";
  title.style.marginBottom = "0.5rem";

  const thumbnail = document.createElement("img");
  thumbnail.src = img.src;
  thumbnail.style.marginBottom = "0.5rem";

  thumbnail.addEventListener("click", () => {
    modalImg.src = thumbnail.src;
    modal.classList.add("open");
  });

  const leftTitle = document.createElement("div");
  leftTitle.className = "section-title";
  leftTitle.textContent = "Apply to All Caption:";

  const rightTitle = document.createElement("div");
  rightTitle.className = "section-title";
  rightTitle.textContent = "Individual Caption:";

  const controls = document.createElement("div");
  controls.className = "controls";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Enter caption";

  const btn = document.createElement("button");
  btn.textContent = "Generate";

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const download = document.createElement("a");
  download.style.display = "none";

  let currentImage = img;

  const generate = (caption) => {
    const padding = 96;
    const fontSize = 96;

    ctx.font = `${fontSize}px sans-serif`;
    const textWidth = ctx.measureText(caption).width;
    const captionHeight = fontSize + padding * 2;

    canvas.width = Math.max(currentImage.width, textWidth + padding * 2);
    canvas.height = currentImage.height + captionHeight;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(currentImage, (canvas.width - currentImage.width) / 2, 0);

    ctx.fillStyle = "black";
    ctx.fillRect(0, currentImage.height, canvas.width, captionHeight);

    ctx.fillStyle = "white";
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      caption,
      canvas.width / 2,
      currentImage.height + captionHeight / 2,
    );

    canvas.toBlob((blob) => {
      const newImg = new Image();
      newImg.onload = () => {
        currentImage = newImg;
        thumbnail.src = newImg.src;
        download.href = newImg.src;
        download.download = `captioned-${filename}`;
        download.style.display = "block";
        download.textContent = "Download";
      };
      newImg.src = URL.createObjectURL(blob);
    });
  };

  btn.addEventListener("click", () => generate(input.value));

  leftSection.appendChild(title);
  leftSection.appendChild(thumbnail);
  leftSection.appendChild(download);

  rightSection.appendChild(rightTitle);
  controls.appendChild(input);
  controls.appendChild(btn);
  rightSection.appendChild(controls);

  item.appendChild(leftSection);
  item.appendChild(rightSection);
  imagesContainer.appendChild(item);

  imageItems.push({ generate });
}
