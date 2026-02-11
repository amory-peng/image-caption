const upload = document.getElementById('upload');
const imagesContainer = document.getElementById('images');
const globalCaption = document.getElementById('globalCaption');
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modalImg');

const imageItems = [];

modal.addEventListener('click', () => {
    modal.classList.remove('open');
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
            img.onload = () => createImageItem(img, file.name);
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
});

function createImageItem(img, filename) {
    const item = document.createElement('div');
    item.className = 'image-item';
    
    const leftSection = document.createElement('div');
    leftSection.className = 'left-section';
    
    const rightSection = document.createElement('div');
    rightSection.className = 'right-section';
    
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
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter caption';
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const download = document.createElement('a');
    download.style.display = 'none';
    
    let leftCaption = '';
    let rightCaption = '';
    let debounce;
    
    const render = () => {
        const padding = 40;
        const fontSize = 96;
        
        ctx.font = `${fontSize}px sans-serif`;
        const captionHeight = fontSize + padding * 2;
        
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
            ctx.fillText(leftCaption, padding, img.height + captionHeight / 2);
        }
        
        if (rightCaption) {
            ctx.textAlign = 'right';
            ctx.fillText(rightCaption, canvas.width - padding, img.height + captionHeight / 2);
        }
        
        canvas.toBlob((blob) => {
            thumbnail.src = URL.createObjectURL(blob);
            download.href = thumbnail.src;
            download.download = `captioned-${filename}`;
            download.style.display = 'block';
            download.textContent = 'Download';
        });
    };
    
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
    
    leftSection.appendChild(title);
    leftSection.appendChild(thumbnail);
    leftSection.appendChild(download);
    
    rightSection.appendChild(rightTitle);
    rightSection.appendChild(input);
    
    item.appendChild(leftSection);
    item.appendChild(rightSection);
    imagesContainer.appendChild(item);
    
    imageItems.push({ setLeftCaption, setRightCaption });
}
