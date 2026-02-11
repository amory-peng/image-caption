import JSZip from 'jszip';

const upload = document.getElementById('upload');
const imagesContainer = document.getElementById('images');
const globalCaption = document.getElementById('globalCaption');
const downloadAllBtn = document.getElementById('downloadAll');
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modalImg');

const imageItems = [];

downloadAllBtn.disabled = true;

modal.addEventListener('click', () => {
    modal.classList.remove('open');
});

downloadAllBtn.addEventListener('click', async () => {
    if (!imageItems.length) {
        return;
    }
    const zip = new JSZip();
    
    for (const item of imageItems) {
        const blob = await item.getBlob();
        if (blob) {
            zip.file(item.filename, blob);
        }
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'captioned-images.zip';
    a.click();
    URL.revokeObjectURL(url);
});

let globalDebounce;
globalCaption.addEventListener('input', (e) => {
    clearTimeout(globalDebounce);
    globalDebounce = setTimeout(() => {
        const caption = e.target.value;
        imageItems.forEach(item => {
            item.setLeftCaption(caption);
        });
    }, 300);
});

upload.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const itemObj = createImageItem(img, file.name);
                if (globalCaption.value) {
                    itemObj.setLeftCaption(globalCaption.value);
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
});

function createImageItem(img, filename) {
    const item = document.createElement('div');
    item.className = 'image-item';
    
    const title = document.createElement('div');
    title.textContent = filename;
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '0.5rem';
    
    const thumbnail = document.createElement('img');
    thumbnail.src = img.src;
    thumbnail.style.marginBottom = '0.5rem';
    
    thumbnail.addEventListener('click', () => {
        modalImg.src = thumbnail.src;
        modal.classList.add('open');
    });
    
    const rightTitle = document.createElement('div');
    rightTitle.className = 'section-title';
    rightTitle.textContent = 'Individual Caption:';
    
    const input = document.createElement('textarea');
    input.placeholder = 'Enter caption';
    input.rows = 2;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const download = document.createElement('a');
    download.style.display = 'none';
    
    let leftCaption = '';
    let rightCaption = '';
    let debounce;
    let currentBlob = null;
    
    const render = () => {
        const padding = 40;
        const fontSize = 96;
        const maxWidth = img.width * 0.5 - padding;
        
        ctx.font = `${fontSize}px sans-serif`;
        
        const leftLines = leftCaption ? getLines(ctx, leftCaption, maxWidth) : [];
        const rightLines = rightCaption ? getLines(ctx, rightCaption, maxWidth) : [];
        const maxLines = Math.max(leftLines.length, rightLines.length, 1);
        const captionHeight = maxLines * fontSize + padding * 2;
        
        canvas.width = img.width;
        canvas.height = img.height + captionHeight;
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.drawImage(img, 0, 0);
        
        ctx.fillStyle = 'black';
        ctx.fillRect(0, img.height, canvas.width, captionHeight);
        
        ctx.fillStyle = 'white';
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textBaseline = 'middle';
        
        if (leftCaption) {
            ctx.textAlign = 'left';
            drawLines(ctx, leftLines, padding, img.height + captionHeight / 2, fontSize);
        }
        
        if (rightCaption) {
            ctx.textAlign = 'right';
            drawLines(ctx, rightLines, canvas.width - padding, img.height + captionHeight / 2, fontSize);
        }
        
        canvas.toBlob((blob) => {
            currentBlob = blob;
            thumbnail.src = URL.createObjectURL(blob);
            download.href = thumbnail.src;
            download.download = `captioned-${filename}`;
            download.style.display = 'block';
            download.textContent = 'Download';
            downloadAllBtn.disabled = false;
        });
    };
    
    const getLines = (ctx, text, maxWidth) => {
        const paragraphs = text.split('\n');
        const lines = [];
        
        for (let paragraph of paragraphs) {
            const words = paragraph.split(' ');
            let line = '';
            
            for (let word of words) {
                const testLine = line + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && line !== '') {
                    lines.push(line);
                    line = word + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line);
        }
        
        return lines;
    };
    
    const drawLines = (ctx, lines, x, y, lineHeight) => {
        const startY = y - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, i) => {
            ctx.fillText(line.trim(), x, startY + i * lineHeight);
        });
    };
    
    const triggerDownload = () => {
        if (currentBlob) {
            download.click();
        }
    };
    
    const getBlob = () => currentBlob;
    
    const setLeftCaption = (caption) => {
        leftCaption = caption;
        render();
    };
    
    const setRightCaption = (caption) => {
        rightCaption = caption;
        render();
    };
    
    input.addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            setRightCaption(e.target.value);
        }, 300);
    });
    
    item.appendChild(title);
    item.appendChild(thumbnail);
    item.appendChild(rightTitle);
    item.appendChild(input);
    item.appendChild(download);
    imagesContainer.appendChild(item);
    
    const itemObj = { setLeftCaption, setRightCaption, download: triggerDownload, getBlob, filename: `captioned-${filename}` };
    imageItems.push(itemObj);
    return itemObj;
}
