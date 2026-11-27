# WPPConnect Server com o "sharp" COMPILADO NA PRÓPRIA MÁQUINA.
#
# Por quê: a imagem oficial traz um sharp pré-compilado que exige CPU x86-64-v2 (SSSE3/SSE4.2/POPCNT).
# Em VMs com CPU virtual antiga (ex.: Proxmox "kvm64") o container cai com
# "Unsupported CPU: Prebuilt binaries for Linux x64 require v2 microarchitecture".
# Aqui o sharp é compilado contra o libvips do Alpine (compilação genérica), sem essa exigência.
#
# Usado pelo serviço "wppconnect" do docker-compose.prod.yml (profile "whatsapp").
FROM wppconnect/wppconnect-server:latest

USER root
WORKDIR /usr/src/wpp-server

# Alpine 3.23 traz libvips 8.17.x, então fixamos um sharp compatível com essa versão (o 0.35 pede libvips >= 8.18.7).
ARG SHARP_VERSION=0.34.5

# Compila numa pasta isolada (/tmp/sb) para não mexer no resto das dependências do servidor,
# e troca só a pasta do sharp (com as dependências dele aninhadas).
RUN apk add --no-cache vips vips-cpp vips-dev \
 && apk add --no-cache --virtual .sharp-build build-base python3 pkgconf \
 && mkdir /tmp/sb && cd /tmp/sb && npm init -y >/dev/null \
 && npm_config_build_from_source=true npm install --no-audit --no-fund "sharp@${SHARP_VERSION}" node-gyp node-addon-api \
 && rm -rf /tmp/sb/node_modules/@img/sharp-* \
 && cd /usr/src/wpp-server \
 && rm -rf node_modules/sharp node_modules/@img/sharp-* \
 && cp -r /tmp/sb/node_modules/sharp node_modules/sharp \
 && mkdir node_modules/sharp/node_modules \
 && for d in @img detect-libc semver color color-string color-convert color-name simple-swizzle is-arrayish; do \
      [ -e "/tmp/sb/node_modules/$d" ] && cp -r "/tmp/sb/node_modules/$d" node_modules/sharp/node_modules/ || true; \
    done \
 && rm -rf /tmp/sb /root/.npm /root/.cache /tmp/* \
 && apk del .sharp-build vips-dev \
 && node -e "const s=require('sharp'); s({create:{width:8,height:8,channels:3,background:'#0a5ab0'}}).png().toBuffer().then(b=>console.log('sharp OK', s.versions.vips, b.length+' bytes'))"
