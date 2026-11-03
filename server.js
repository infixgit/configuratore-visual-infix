const express = require('express');
const cors = require('cors');
const SibApiV3Sdk = require('sib-api-v3-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' })); // Aumentato a 20mb per gestire più foto
app.use(cors());

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

app.post('/api/send-visual-request', async (req, res) => {
  const { category, subCategory, diagnosis, address, notes, name, phone, email, images } = req.body;

  if (!email || !name || !category) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti.' });
  }

  // Gestione di più allegati foto
  let attachments = [];
  if (images && Array.isArray(images)) {
    images.forEach((imgBase64, index) => {
      const base64Content = imgBase64.split(';base64,').pop();
      attachments.push({
        content: base64Content,
        name: `foto_stato_attuale_${index + 1}_${Date.now()}.jpg`
      });
    });
  }

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = `Nuova Richiesta Visual INFIX®: ${category} - ${name}`;
  sendSmtpEmail.sender = { name: "Visual INFIX® Web", email: process.env.SENDER_EMAIL || "info@infix.it" };
  sendSmtpEmail.to = [{ email: process.env.RECIPIENT_EMAIL || "info@infix.it", name: "Ufficio Tecnico INFIX" }];
  
  sendSmtpEmail.htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #004070; border-bottom: 2px solid #4CAF50; padding-bottom: 8px;">
        Nuova Richiesta Preventivo - Visual INFIX®
      </h2>
      <p><strong>Cliente / Azienda:</strong> ${name}</p>
      <p><strong>Telefono / WhatsApp:</strong> ${phone}</p>
      <p><strong>Email Cliente:</strong> ${email}</p>
      <p><strong>Indirizzo Cantiere / Intervento:</strong> ${address || 'Non specificato'}</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;" />
      <h3>Dettagli Tecnici Selezionati:</h3>
      <ul>
        <li><strong>Macro Categoria:</strong> ${category}</li>
        <li><strong>Tipologia / Materiale:</strong> ${subCategory}</li>
        <li><strong>Esigenza / Problema Rilevato:</strong> ${diagnosis}</li>
      </ul>
      <p><strong>Note e Preferenze aggiuntive:</strong></p>
      <blockquote style="background: #f9f9f9; padding: 10px; border-left: 4px solid #004070;">
        ${notes || 'Nessuna nota inserita.'}
      </blockquote>
      <p><em>Numero di foto allegate: ${attachments.length}</em></p>
    </div>
  `;
  
  if (attachments.length > 0) {
    sendSmtpEmail.attachment = attachments;
  }

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    res.status(200).json({ message: 'Email inviata con successo!' });
  } catch (error) {
    console.error('Errore invio Brevo:', error);
    res.status(500).json({ error: 'Errore nell\'invio dell\'email' });
  }
});

app.listen(PORT, () => {
  console.log(`Server Visual INFIX attivo sulla porta ${PORT}`);
});
