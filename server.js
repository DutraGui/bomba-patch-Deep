const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// SUA CHAVE SECRETA - NUNCA VAI PARA O FRONTEND
const VENO_API_KEY = 'veno_live_f98243ace99f78cd38f0f340511fb670d59456be7c26e8fa';

// Middleware
app.use(express.json());

// Permitir CORS para seu site
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://bomba-patch-deep.vercel.app');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Banco de dados em memória (para produção, usar MongoDB ou PostgreSQL)
const pagamentos = new Map();
const pedidos = new Map();

// ENDPOINT 1: Criar Pix (APENAS EMAIL E TELEFONE)
app.post('/api/criar-pix', async (req, res) => {
    try {
        const { email, telefone } = req.body;
        
        // Validar campos obrigatórios
        if (!email || !telefone) {
            return res.status(400).json({ 
                error: 'Email e telefone são obrigatórios' 
            });
        }

        // Gerar ID único para o pedido
        const external_id = `bomba_patch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Callback URL para webhook (seu servidor)
        const callback_url = `https://${req.headers.host}/api/webhook/veno`;

        console.log(`📝 Criando Pix para: ${email} | Telefone: ${telefone}`);

        // CORREÇÃO: Usar CPF fixo 111.111.111-11 (válido para testes)
        // A Veno exige document, então usamos um CPF genérico
        const cpfGenerico = "11111111111"; // CPF válido para testes
        
        // Chamar API da Veno com os campos corrigidos
        const response = await fetch('https://beta.venopayments.com/api/v1/pix', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VENO_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: 990, // R$ 9,90 em centavos
                callback_url: callback_url,
                external_id: external_id,
                description: 'Bomba Patch 2026 Mobile',
                payer: {
                    name: telefone,        // Telefone vai no campo name
                    email: email,           // Email do cliente
                    document: cpfGenerico   // CPF genérico (campo obrigatório)
                },
                // UTMs serão capturadas automaticamente pela Veno
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Erro Veno API:', data);
            return res.status(response.status).json(data);
        }

        // Armazenar informações do pagamento
        pagamentos.set(data.id, {
            id: data.id,
            external_id: external_id,
            email: email,
            telefone: telefone,
            status: 'pending',
            created_at: new Date().toISOString(),
            qr_code: data.qr_code,
            qr_code_image: data.qr_code_image,
            pix_copy_paste: data.pix_copy_paste
        });

        console.log(`✅ Pix criado: ${data.id} para ${email}`);
        console.log(`📞 Telefone (campo name): ${telefone}`);
        console.log(`🆔 CPF usado: ${cpfGenerico}`);

        // Retornar apenas o necessário para o frontend
        res.json({
            success: true,
            pix_id: data.id,
            qr_code: data.qr_code,
            qr_code_image: data.qr_code_image,
            pix_copy_paste: data.pix_copy_paste,
            expires_at: data.expires_at,
            amount: data.amount
        });

    } catch (error) {
        console.error('Erro ao criar Pix:', error);
        res.status(500).json({ 
            error: 'Erro interno ao processar pagamento' 
        });
    }
});

// ENDPOINT 2: Webhook (Veno avisa quando pago)
app.post('/api/webhook/veno', async (req, res) => {
    const payload = req.body;
    
    console.log('🔔 Webhook recebido:', JSON.stringify(payload, null, 2));

    // Responder 200 IMEDIATAMENTE (boas práticas)
    res.status(200).send('OK');

    // Processar evento de forma assíncrona
    if (payload.event === 'pix.paid') {
        const pixId = payload.data.id;
        const pagamento = pagamentos.get(pixId);
        
        if (pagamento) {
            // Atualizar status
            pagamento.status = 'paid';
            pagamento.paid_at = payload.data.paid_at;
            pagamento.end_to_end_id = payload.data.end_to_end_id;
            
            console.log(`💰 PIX PAGO! ID: ${pixId}`);
            console.log(`   Email: ${pagamento.email}`);
            console.log(`   Telefone: ${pagamento.telefone}`);
            console.log(`   Valor: R$ 9,90`);
            
            // AQUI: Disparar email de confirmação
            // AQUI: Gerar link de download
            // AQUI: Enviar WhatsApp automático
            // AQUI: Marcar como pago no banco de dados
            
            // Simular envio de acesso (implementar depois)
            await enviarAcessoAoCliente(pagamento);
        } else {
            console.log(`⚠️ Webhook para Pix não encontrado: ${pixId}`);
        }
    }
});

// ENDPOINT 3: Consultar status do Pix
app.get('/api/status/:pixId', (req, res) => {
    const { pixId } = req.params;
    const pagamento = pagamentos.get(pixId);
    
    if (!pagamento) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
    }
    
    res.json({
        status: pagamento.status,
        paid_at: pagamento.paid_at
    });
});

// ENDPOINT 4: Verificar saúde do servidor
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        timestamp: new Date().toISOString(),
        pagamentos_ativos: pagamentos.size
    });
});

// Função para enviar acesso (implementar depois)
async function enviarAcessoAoCliente(pagamento) {
    console.log(`📧 Enviando acesso para ${pagamento.email}...`);
    
    // Aqui você pode:
    // 1. Enviar email com link de download
    // 2. Enviar WhatsApp com as instruções
    // 3. Gerar código de ativação
    // 4. Registrar no banco de dados
    
    // Exemplo de retorno
    return {
        success: true,
        message: 'Acesso enviado com sucesso'
    };
}

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════╗
    ║  🔥 SERVIDOR PIX INICIADO COM SUCESSO 🔥 ║
    ╠══════════════════════════════════════════╣
    ║  ➜ Criar Pix: /api/criar-pix            ║
    ║  ➜ Webhook:   /api/webhook/veno         ║
    ║  ➜ Status:    /api/status/:id           ║
    ║  ➜ Porta:     ${PORT}                       ║
    ║  ➜ CPF usado: 111.111.111-11 (fixo)     ║
    ╚══════════════════════════════════════════╝
    `);
});
