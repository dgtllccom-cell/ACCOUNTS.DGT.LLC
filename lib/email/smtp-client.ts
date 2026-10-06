import net from "net";
import tls from "tls";

export type SmtpConfig = {
  host: string;
  port: number;
  secure?: boolean; // true for port 465 (direct TLS), false for 587/25
  auth?: {
    user: string;
    pass: string;
  };
};

export type MailOptions = {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64 encoded string
    contentType?: string;
  }>;
};

function parseEmails(emails: string | string[] | undefined): string[] {
  if (!emails) return [];
  if (Array.isArray(emails)) return emails;
  return emails
    .split(",")
    .map((e) => {
      const match = e.match(/<([^>]+)>/);
      return match ? match[1].trim() : e.trim();
    })
    .filter(Boolean);
}

export function sendEmailDirect(config: SmtpConfig, options: MailOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const toList = parseEmails(options.to);
    const ccList = parseEmails(options.cc);
    const bccList = parseEmails(options.bcc);
    const recipients = [...toList, ...ccList, ...bccList];

    if (recipients.length === 0) {
      return reject(new Error("No recipients specified."));
    }

    const host = config.host;
    const port = config.port;
    const isSecure = config.secure ?? (port === 465);

    let socket: net.Socket;
    const log: string[] = [];

    const handleConnection = (connectedSocket: net.Socket) => {
      socket = connectedSocket;
      let buffer = "";

      const sendCommand = (cmd: string) => {
        log.push(`CLIENT: ${cmd.trim().slice(0, 100)}`);
        socket.write(cmd + "\r\n");
      };

      const closeSocket = () => {
        try {
          socket.end();
        } catch {}
      };

      // State machine for SMTP dialogue
      let state = "CONNECT";

      socket.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\r\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          log.push(`SERVER: ${line}`);
          const code = parseInt(line.slice(0, 3));
          const isMultiline = line.charAt(3) === "-";

          if (isMultiline) continue; // wait for final line

          if (state === "CONNECT") {
            if (code === 220) {
              state = "EHLO";
              sendCommand(`EHLO ${config.host}`);
            } else {
              closeSocket();
              return reject(new Error(`SMTP connection failed: ${line}`));
            }
          } else if (state === "EHLO") {
            if (code === 250) {
              if (config.auth) {
                state = "AUTH_LOGIN";
                sendCommand("AUTH LOGIN");
              } else {
                state = "MAIL_FROM";
                sendCommand(`MAIL FROM:<${options.from}>`);
              }
            } else {
              closeSocket();
              return reject(new Error(`SMTP EHLO failed: ${line}`));
            }
          } else if (state === "AUTH_LOGIN") {
            if (code === 334) {
              state = "AUTH_USER";
              sendCommand(Buffer.from(config.auth!.user).toString("base64"));
            } else {
              closeSocket();
              return reject(new Error(`SMTP AUTH login command failed: ${line}`));
            }
          } else if (state === "AUTH_USER") {
            if (code === 334) {
              state = "AUTH_PASS";
              sendCommand(Buffer.from(config.auth!.pass).toString("base64"));
            } else {
              closeSocket();
              return reject(new Error(`SMTP AUTH user failed: ${line}`));
            }
          } else if (state === "AUTH_PASS") {
            if (code === 235) {
              state = "MAIL_FROM";
              sendCommand(`MAIL FROM:<${options.from}>`);
            } else {
              closeSocket();
              return reject(new Error(`SMTP Authentication failed: ${line}`));
            }
          } else if (state === "MAIL_FROM") {
            if (code === 250) {
              state = "RCPT_TO";
              thisRecipientIndex = 0;
              sendNextRcpt();
            } else {
              closeSocket();
              return reject(new Error(`SMTP MAIL FROM failed: ${line}`));
            }
          } else if (state === "RCPT_TO") {
            if (code === 250 || code === 251) {
              thisRecipientIndex++;
              sendNextRcpt();
            } else {
              closeSocket();
              return reject(new Error(`SMTP RCPT TO failed for recipient: ${line}`));
            }
          } else if (state === "DATA") {
            if (code === 354) {
              state = "SEND_CONTENT";
              sendMailContent();
            } else {
              closeSocket();
              return reject(new Error(`SMTP DATA initialization failed: ${line}`));
            }
          } else if (state === "SEND_CONTENT") {
            if (code === 250) {
              state = "QUIT";
              sendCommand("QUIT");
            } else {
              closeSocket();
              return reject(new Error(`SMTP message body delivery failed: ${line}`));
            }
          } else if (state === "QUIT") {
            closeSocket();
            return resolve(`Message sent successfully. Server log ID: ${line}`);
          }
        }
      });

      let thisRecipientIndex = 0;
      function sendNextRcpt() {
        if (thisRecipientIndex < recipients.length) {
          sendCommand(`RCPT TO:<${recipients[thisRecipientIndex]}>`);
        } else {
          state = "DATA";
          sendCommand("DATA");
        }
      }

      function sendMailContent() {
        const boundary = "----=_Part_" + Math.random().toString(36).slice(2) + "_" + Date.now();
        const headers: string[] = [];

        headers.push(`From: ${options.from}`);
        headers.push(`To: ${Array.isArray(options.to) ? options.to.join(", ") : options.to}`);
        if (options.cc) {
          headers.push(`Cc: ${Array.isArray(options.cc) ? options.cc.join(", ") : options.cc}`);
        }
        headers.push(`Subject: ${options.subject}`);
        headers.push("MIME-Version: 1.0");
        headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
        headers.push(`Date: ${new Date().toUTCString()}`);
        headers.push("");

        let body = headers.join("\r\n");

        // Body boundary part
        body += `--${boundary}\r\n`;
        if (options.html) {
          body += "Content-Type: text/html; charset=UTF-8\r\n";
          body += "Content-Transfer-Encoding: 7bit\r\n\r\n";
          body += options.html + "\r\n";
        } else {
          body += "Content-Type: text/plain; charset=UTF-8\r\n";
          body += "Content-Transfer-Encoding: 7bit\r\n\r\n";
          body += (options.text || "") + "\r\n";
        }

        // Attachments boundary parts
        if (options.attachments && options.attachments.length > 0) {
          for (const att of options.attachments) {
            body += `--${boundary}\r\n`;
            body += `Content-Type: ${att.contentType || "application/octet-stream"}; name="${att.filename}"\r\n`;
            body += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
            body += "Content-Transfer-Encoding: base64\r\n\r\n";
            // Clean base64 input from headers or prefixes if any
            const cleanedBase64 = att.content.replace(/^data:.*?;base64,/, "");
            body += cleanedBase64.match(/.{1,76}/g)?.join("\r\n") || cleanedBase64;
            body += "\r\n";
          }
        }

        body += `--${boundary}--\r\n`;
        body += "."; // final terminating dot

        socket.write(body + "\r\n");
      }

      socket.on("error", (err) => {
        reject(new Error(`SMTP Socket Error: ${err.message}. Log: ${log.join(" -> ")}`));
      });
    };

    try {
      if (isSecure) {
        const tlsSocket = tls.connect({
          host,
          port,
          rejectUnauthorized: false // Allow self-signed or unverified certificates for flexibility
        }, () => {
          handleConnection(tlsSocket);
        });
        tlsSocket.on("error", (err) => {
          reject(new Error(`Secure connection error: ${err.message}`));
        });
      } else {
        const netSocket = net.createConnection({ host, port }, () => {
          handleConnection(netSocket);
        });
        netSocket.on("error", (err) => {
          reject(new Error(`Connection error: ${err.message}`));
        });
      }
    } catch (err: any) {
      reject(new Error(`SMTP init failed: ${err.message}`));
    }
  });
}

export function testSmtpConnection(config: SmtpConfig): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const host = config.host;
    const port = config.port;
    const isSecure = config.secure ?? (port === 465);

    let socket: net.Socket;
    const log: string[] = [];

    const handleConnection = (connectedSocket: net.Socket) => {
      socket = connectedSocket;
      let buffer = "";

      const sendCommand = (cmd: string) => {
        log.push(`CLIENT: ${cmd.trim().slice(0, 100)}`);
        socket.write(cmd + "\r\n");
      };

      const closeSocket = () => {
        try {
          socket.end();
        } catch {}
      };

      let state = "CONNECT";

      socket.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\r\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          log.push(`SERVER: ${line}`);
          const code = parseInt(line.slice(0, 3));
          const isMultiline = line.charAt(3) === "-";

          if (isMultiline) continue;

          if (state === "CONNECT") {
            if (code === 220) {
              state = "EHLO";
              sendCommand(`EHLO ${config.host}`);
            } else {
              closeSocket();
              return reject(new Error(`SMTP connection failed: ${line}`));
            }
          } else if (state === "EHLO") {
            if (code === 250) {
              if (config.auth) {
                state = "AUTH_LOGIN";
                sendCommand("AUTH LOGIN");
              } else {
                state = "QUIT";
                sendCommand("QUIT");
              }
            } else {
              closeSocket();
              return reject(new Error(`SMTP EHLO failed: ${line}`));
            }
          } else if (state === "AUTH_LOGIN") {
            if (code === 334) {
              state = "AUTH_USER";
              sendCommand(Buffer.from(config.auth!.user).toString("base64"));
            } else {
              closeSocket();
              return reject(new Error(`SMTP AUTH login command failed: ${line}`));
            }
          } else if (state === "AUTH_USER") {
            if (code === 334) {
              state = "AUTH_PASS";
              sendCommand(Buffer.from(config.auth!.pass).toString("base64"));
            } else {
              closeSocket();
              return reject(new Error(`SMTP AUTH user failed: ${line}`));
            }
          } else if (state === "AUTH_PASS") {
            if (code === 235) {
              state = "QUIT";
              sendCommand("QUIT");
            } else {
              closeSocket();
              return reject(new Error(`SMTP Authentication failed: ${line}`));
            }
          } else if (state === "QUIT") {
            closeSocket();
            return resolve(true);
          }
        }
      });

      socket.on("error", (err) => {
        reject(new Error(`SMTP Socket Error: ${err.message}. Log: ${log.join(" -> ")}`));
      });
    };

    try {
      if (isSecure) {
        const tlsSocket = tls.connect({
          host,
          port,
          rejectUnauthorized: false
        }, () => {
          handleConnection(tlsSocket);
        });
        tlsSocket.on("error", (err) => {
          reject(new Error(`Secure connection error: ${err.message}`));
        });
      } else {
        const netSocket = net.createConnection({ host, port }, () => {
          handleConnection(netSocket);
        });
        netSocket.on("error", (err) => {
          reject(new Error(`Connection error: ${err.message}`));
        });
      }
    } catch (err: any) {
      reject(new Error(`SMTP init failed: ${err.message}`));
    }
  });
}
