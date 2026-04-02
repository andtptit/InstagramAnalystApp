const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function launchBrowser() {
    const userDataDir = path.join(__dirname, 'user_data');
    return await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: ['--disable-blink-features=AutomationControlled', '--window-size=1280,800'],
        viewport: { width: 1280, height: 800 }
    });
}

// Hàm 1: Cuộn trang Profile -> Lấy Link -> Check Tim tĩnh, Lọc Carousel và Đếm số ảnh
async function discoverPosts(profileUrl, limit = 20, minLikes = 0, minImages = 4, onlyCarousel = true) {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    const postUrls = new Set();
    const resultUrls = [];

    try {
        console.log(`[Khám Phá] Đang truy cập Profile: ${profileUrl}`);
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(3000);

        const isLoggedIn = await page.locator('svg[aria-label="Home"]').isVisible() || 
                           await page.locator('svg[aria-label="Search"]').isVisible();
        
        if (!isLoggedIn) {
            console.log("[Khám Phá] Chưa đăng nhập. Vui lòng đăng nhập tay trên trình duyệt (đợi tối đa 5 phút)...");
            await page.waitForSelector('svg[aria-label="Home"], svg[aria-label="Search"]', { timeout: 300000 });
            console.log("[Khám Phá] Đăng nhập thành công!");
        }

        console.log(`[Khám Phá] Bắt đầu cuộn trang mồi để lấy ${limit} bài viết mới nhất...`);
        let previousUrlsCount = 0;
        let retries = 0;

        while (postUrls.size < limit && retries < 5) {
            const links = await page.$$eval('a[href*="/p/"], a[href*="/reel/"]', elements => elements.map(el => el.href));
            
            for (const link of links) {
                const cleanUrl = link.split('?')[0];
                postUrls.add(cleanUrl);
            }

            if (postUrls.size >= limit) break;

            if (postUrls.size === previousUrlsCount) {
                retries++;
            } else {
                retries = 0;
                previousUrlsCount = postUrls.size;
            }

            await page.evaluate(() => window.scrollBy(0, 1000));
            const randomWait = 1500 + Math.random() * 2000;
            console.log(`[Khám Phá] Đang lấy mồi: ${postUrls.size}/${limit} bài. Đợi ${Math.round(randomWait)}ms...`);
            await page.waitForTimeout(randomWait); 
        }

        const urlsToCheck = Array.from(postUrls).slice(0, limit);
        console.log(`[Lọc Tĩnh] Lọc ${urlsToCheck.length} link. (MinLikes: ${minLikes}, MinImages: ${minImages}, OnlyCarousel: ${onlyCarousel})`);

        // Bộ lọc tĩnh Lượt Thích và Thuộc tính Post
        for (let i = 0; i < urlsToCheck.length; i++) {
            const url = urlsToCheck[i];
            
            if (minLikes <= 0 || isNaN(minLikes)) {
                console.log(`[Lọc Tĩnh] Bỏ qua kiểm tra độ hot -> CHẤP NHẬN: ${url}`);
                resultUrls.push(url);
                continue;
            }

            console.log(`[Lọc Tĩnh] Đang mở bài (${i+1}/${urlsToCheck.length}): Xét duyệt Lượt Thích...`);
            try {
                // Nhảy vào từng bài viết (Rất nhanh chỉ lấy số rồi ra)
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(1500);

                let likesNumeric = 0;
                
                // Thuật toán quét toàn văn (Full-Text Regex) kết hợp Tìm Max
                // Lý do: Các Comment ở trên có thể có chữ "5 likes", khiến Regex cũ lấy nhầm và bỏ qua "6,400 likes" ở tuốt bên dưới.
                let maxLikesNumeric = 0;
                
                // 1. Phân tích Thẻ ẩn SEO (Độ vắng mặt của Comment) - [Cách đỉnh cấp nhất 2024]
                // Instagram luôn giấu chính xác lượt thích và bình luận trong thẻ <meta property="og:description">
                // Ví dụ: "6,400 likes, 102 comments - southkorea.explores on March 4, 2024: ..."
                const metaDesc = await page.$eval('meta[property="og:description"]', el => el.content).catch(() => null);
                if (metaDesc) {
                    const metaMatch = metaDesc.match(/^([0-9.,KkMm]+)\s*(likes|lượt thích)/i);
                    if (metaMatch) {
                        let str = metaMatch[1].toLowerCase();
                        if (str.includes('k')) maxLikesNumeric = parseFloat(str.replace(/k/i, '').replace(',', '.')) * 1000;
                        else if (str.includes('m')) maxLikesNumeric = parseFloat(str.replace(/m/i, '').replace(',', '.')) * 1000000;
                        else maxLikesNumeric = parseInt(str.replace(/[.,]/g, '')) || 0;
                    }
                }

                // 2. Kế hoạch B: Dò Body (Nếu Meta thiếu, ví dụ Reels đôi khi khác biệt)
                if (maxLikesNumeric === 0) {
                    const bodyText = await page.evaluate(() => document.body.innerText);
                    const regexLikes = /([0-9.,KkMm]+)\s*(likes|lượt thích)/gi;
                    let match;
                    while ((match = regexLikes.exec(bodyText)) !== null) {
                        let val = 0; let str = match[1].toLowerCase();
                        if (str.includes('k')) val = parseFloat(str.replace(/k/i, '').replace(',', '.')) * 1000;
                        else if (str.includes('m')) val = parseFloat(str.replace(/m/i, '').replace(',', '.')) * 1000000;
                        else val = parseInt(str.replace(/[.,]/g, '')) || 0;
                        if (val > maxLikesNumeric) maxLikesNumeric = val;
                    }

                    const regexOthers = /(?:and|và)\s+([0-9.,KkMm]+)\s*(?:others|người khác)/gi;
                    while ((match = regexOthers.exec(bodyText)) !== null) {
                        let val = 0; let str = match[1].toLowerCase();
                        if (str.includes('k')) val = parseFloat(str.replace(/k/i, '').replace(',', '.')) * 1000;
                        else if (str.includes('m')) val = parseFloat(str.replace(/m/i, '').replace(',', '.')) * 1000000;
                        else val = parseInt(str.replace(/[.,]/g, '')) || 0;
                        if (val > maxLikesNumeric) maxLikesNumeric = val;
                    }
                }

                if (maxLikesNumeric > 0) {
                    if (maxLikesNumeric >= minLikes) {
                        // Kiểm tra Carousel và số lượng Slide tối thiểu
                        let isCarousel = false;
                        let slideCount = 1;

                        const nextButtonSel = 'button[aria-label="Next"], button[aria-label="Tiếp theo"], .coreSpriteRightChevron';
                        const nextBtnInitial = await page.$(nextButtonSel);
                        if (nextBtnInitial) isCarousel = true;

                        if (onlyCarousel && !isCarousel) {
                            console.log(`[Lọc Tĩnh] ❌ TRƯỢT -> Bài viết không phải dạng Carousel (Có thể là Reel/Single).`);
                            continue;
                        }

                        if (minImages > 1) {
                            if (!isCarousel) {
                                slideCount = 1;
                            } else {
                                let currentCount = 1;
                                // Đếm nội suy: Cố gắng click 'Next' để xác minh số slide (chỉ click đến khi đạt minImages)
                                while(currentCount < minImages) {
                                    const nextBtn = await page.$(nextButtonSel);
                                    if (nextBtn) {
                                        await nextBtn.click();
                                        await page.waitForTimeout(600); // Chờ DOM render nút Next mới
                                        currentCount++;
                                    } else {
                                        break;
                                    }
                                }
                                slideCount = currentCount;
                            }

                            if (slideCount < minImages) {
                                console.log(`[Lọc Tĩnh] ❌ TRƯỢT -> Số ảnh (${slideCount}) không đủ yêu cầu tối thiểu (${minImages}).`);
                                continue;
                            }
                        }

                        console.log(`[Lọc Tĩnh] ✅ ĐẠT (${maxLikesNumeric} Likes, ${slideCount}+ Slides) -> THÊM VÀO URL LIST`);
                        resultUrls.push(url);
                    } else {
                        console.log(`[Lọc Tĩnh] ❌ TRƯỢT (${maxLikesNumeric} Likes < ${minLikes})`);
                    }
                } else {
                    console.log(`[Lọc Tĩnh] ⚠️ Ẩn Like (Không xác định được số). Bỏ qua bài này.`);
                }
            } catch (e) {
                console.log(`[Lọc Tĩnh] Lỗi truy cập bài: ${e.message}`);
            }

            // Trễ xíu để tránh bị chặn IP
            await page.waitForTimeout(1000 + Math.random() * 800);
        }

        return resultUrls;
    } catch (err) {
        console.error("[Khám Phá] Khủng hoảng toàn cục:", err.message);
        return resultUrls;
    } finally {
        await browser.close();
    }
}

// Hàm 2: Truy cập 1 bài viết, nhấn Next và chụp chùm ảnh
async function getInstagramData(url) {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    const screenshots = [];
    let likesCount = "N/A";

    try {
        console.log(`[Mắt Thần] Đang tiếp cận: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(3000); 

        // Lấy số Like, Caption và Url Kênh (Author)
        let caption = "N/A";
        let authorUrl = "N/A";

        try {
            // 1. Trích xuất Author URL (Link Kênh) - Tìm thẻ a chứa link profile trong header bài viết
            authorUrl = await page.evaluate(() => {
                const authorLink = document.querySelector('header a[href*="/"]');
                return authorLink ? authorLink.href : "N/A";
            });

            const metaDesc = await page.$eval('meta[property="og:description"]', el => el.content).catch(() => null);
            let metaHandled = false;
            
            if (metaDesc) {
                // 1. Phân tách Likes
                const metaMatch = metaDesc.match(/^([0-9.,KkMm]+)\s*(likes|lượt thích)/i);
                if (metaMatch) {
                    likesCount = metaMatch[1];
                    metaHandled = true;
                }
                
                // 2. Phân tách Caption (Cực kỳ cẩn thận với dấu ngoặc kép)
                const captionMatch = metaDesc.match(/:\s*"(.*)"$/);
                if (captionMatch) {
                    caption = captionMatch[1];
                } else {
                    // Nếu metaDesc bị cắt cụt, lấy từ og:title (thường chứa caption ngắn)
                    const ogTitle = await page.$eval('meta[property="og:title"]', el => el.content).catch(() => "");
                    caption = ogTitle || await page.title();
                }
            }

            // Nếu vẫn là "Instagram", cố gắng lấy Caption từ bài viết
            if (caption === "Instagram" || caption === "N/A") {
                caption = await page.evaluate(() => {
                    const h1 = document.querySelector('h1'); // Thường chứa caption bài viết
                    return h1 ? h1.innerText : "N/A";
                });
            }

            // Fallback likes
            if (!metaHandled) {
                const bodyText = await page.evaluate(() => document.body.innerText);
                let maxLikesNumeric = 0;
                let displayStr = "N/A";
                const regexLikes = /([0-9.,KkMm]+)\s*(likes|lượt thích)/gi;
                let match;
                while ((match = regexLikes.exec(bodyText)) !== null) {
                    let val = 0; let str = match[1].trim(); let cleanStr = str.toLowerCase();
                    if (cleanStr.includes('k')) val = parseFloat(cleanStr.replace(/k/i, '').replace(',', '.')) * 1000;
                    else if (cleanStr.includes('m')) val = parseFloat(cleanStr.replace(/m/i, '').replace(',', '.')) * 1000000;
                    else val = parseInt(cleanStr.replace(/[.,]/g, '')) || 0;
                    if (val > maxLikesNumeric) { maxLikesNumeric = val; displayStr = str; }
                }
                if (maxLikesNumeric > 0) likesCount = displayStr;
            }
        } catch (e) { }

        console.log(`[Mắt Thần] Kênh tác giả: ${authorUrl}`);
        console.log(`[Mắt Thần] Caption: ${caption.substring(0, 50)}...`);

        console.log(`[Mắt Thần] Bắt đầu chụp ảnh các phân cảnh...`);
        let slideCount = 1;
        const maxSlides = 15; 

        while (true) {
            console.log(`[Mắt Thần] Đang chụp Screenshot Slide #${slideCount}...`);
            await page.waitForTimeout(800); 

            let buffer;
            try {
                const article = await page.$('article');
                if (article) {
                    buffer = await article.screenshot({ type: 'jpeg', quality: 90 });
                } else {
                    buffer = await page.screenshot({ type: 'jpeg', quality: 90 });
                }
            } catch(e) {
                buffer = await page.screenshot({ type: 'jpeg', quality: 90 });
            }
            
            screenshots.push({
                mimeType: "image/jpeg",
                data: buffer.toString('base64')
            });

            // Tìm nút next
            const nextButton = await page.$('button[aria-label="Next"], button[aria-label="Tiếp theo"]');
            if (nextButton) {
                await nextButton.click();
            } else {
                const fallbackBtn = await page.$('.coreSpriteRightChevron');
                if (fallbackBtn) {
                    await fallbackBtn.click();
                } else {
                    break; 
                }
            }

            slideCount++;
            if (slideCount > maxSlides) break;

            await page.waitForTimeout(1500 + Math.random() * 1000);
        }

        console.log(`[Mắt Thần] Thu thập dữ liệu trót lọt: ${screenshots.length} tấm hình độ phân giải cao.`);

        return {
            url,
            likesCount: likesCount,
            caption: caption,
            authorUrl: authorUrl,
            totalSlidesFound: screenshots.length,
            images: screenshots 
        };

    } catch (error) {
        console.error(`[Mắt Thần] Sự cố: ${error.message}`);
        throw error;
    } finally {
        await browser.close();
    }
}

module.exports = {
    getInstagramData,
    discoverPosts
};
