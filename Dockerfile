# 1. Isticmaal Node.js image rasmiga ah
FROM node:18

# 2. Samee folder-ka shaqada ee gudaha server-ka
WORKDIR /app

# 3. Nuqul ka samee folder-ka backend-ka oo kaliya kuna dhex tuur server-ka
COPY backend/package*.json ./

# 4. Ku shub dhamaan packages-ka uu backend-ku u baahanyahay
RUN npm install

# 5. Soo raddi dhamaan files-ka backend-ka
COPY backend/ .

# 6. Hugging Face waxay u baahan tahay Port-ka 7860
EXPOSE 7860
ENV PORT=7860

# 7. Kici server-ka (Haddii faylkaaga ugu weyn uu yahay server.js)
CMD ["node", "server.js"]
