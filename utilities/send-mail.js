"use strict";
const nodemailer = require("nodemailer");
const request = require("request");
const $ = require("cheerio");
const ejs = require('ejs');
const fs  = require('fs');
const path = require('path');

let config = {
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
};

if (process.env.SMTP_SERVICE != null) {
    config.service = process.env.SMTP_SERVICE;
} else {
    config.host = process.env.SMTP_HOST;
    config.port = parseInt(process.env.SMTP_PORT);
    config.secure = process.env.SMTP_SECURE === "false" ? false : true;
}
// 邮箱客户端
const transporter = nodemailer.createTransport(config);

/**
 * 获取模板
 */
let templateName = process.env.TEMPLATE_NAME ?  process.env.TEMPLATE_NAME : "default";
let noticeTemplate = ejs.compile(fs.readFileSync(path.resolve(process.cwd(), 'template', templateName, 'notice.ejs'), 'utf8'));
let sendTemplate = ejs.compile(fs.readFileSync(path.resolve(process.cwd(), 'template', templateName, 'send.ejs'), 'utf8'));


/**
 * 验证邮箱是否可用
 */
transporter.verify(function (error, success) {
    if (error) {
        console.log("SMTP邮箱配置异常：", error);
    }
    if (success) {
        console.log("SMTP邮箱配置正常！");
    }
});

/**
 * 通知博主
 * @param comment
 */
exports.notice = (comment) => {
    let emailSubject = '👉 咚！博主大人！「' + process.env.SITE_NAME + '」上有新评论了';
    let data = {
        siteName: process.env.SITE_NAME,
        siteUrl: process.env.SITE_URL,
        name: comment.get('nick'),
        text: comment.get('comment'),
        url: process.env.SITE_URL + comment.get('url')
    };
    let emailContent =  noticeTemplate(data);

    let mailOptions = {
        from: '"' + process.env.SENDER_NAME + '" <' + process.env.SMTP_USER + '>',
        to: process.env.TO_EMAIL ? process.env.TO_EMAIL : process.env.SMTP_USER,
        subject: emailSubject,
        html: emailContent
    };


    transporter.sendMail(mailOptions, (error, info) => {
        if (error) return console.log(error);
        console.log("博主通知邮件成功发送: %s", info.response);
        comment.set("isNotified", true);
        comment.save();
    });

    /**
     * 推送微信消息
     */
    if (process.env.SC_KEY != null) {
        const ScDespTemplate = `
#### ${data.name} 给您的回复如下：
        
> ${data.text}
        
#### 您可以点击[查看回复的完整內容](${data.url})`;
        const ScTextTemplate = `您在 ${ process.env.SITE_NAME} 上有新评论啦！`;

        const _DespTemplate = process.env.SC_DESP_TEMPLATE || ScDespTemplate;
        const _TextTemplate = process.env.SC_TEXT_TEMPLATE || ScTextTemplate;
        request(
            {
                url: `https://sctapi.ftqq.com/${process.env.SC_KEY}.send`,
                method: "POST",
                body: `title=${_TextTemplate}&desp=${_DespTemplate}`,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                },
            },
            function (error, response, body) {
                if (error) return console.log("发送微信提醒异常：", error);
                if (body) body = JSON.parse(body);
                if (response.statusCode === 200 && body.errmsg === "success")
                    console.log("已发送微信提醒");
                else console.warn("微信提醒失败:", body);
            }
        );
    }

  /**
   * QMSG发送消息
   */
  if (process.env.QMSG_KEY != null) {
        if (process.env.QQ_SHAKE != null) {
            let shakeTemplate = process.env.SHAKE_TEMPLATE || "79";
            request(
                `https://qmsg.zendee.cn/send/${process.env.QMSG_KEY}?msg=@face=${shakeTemplate}@`,
                function (error, response, body) {
                    if (error) return console.log("调起QQ戳一戳功能异常：", error);
                    if (body) body = JSON.parse(body);
                    if (response.statusCode === 200 && body.success === true)
                        console.log("已成功戳一戳！");
                    else console.warn("QQ戳一戳失败:", body);
                }
            );
        }
        var comment = $(
            COMMENT.replace(/<img.*?src="(.*?)".*?>/g, "\n[图片]$1\n").replace(
                /<br>/g,
                "\n"
            )
        )
            .text()
            .replace(/\n+/g, "\n")
            .replace(/\n+$/g, "");
        const QmsgTemplate = `您在 ${data.siteName} 上有新评论啦！
${data.name} 给您的回复如下：
           
    ${data.text}
        
您可以点击 ${data.url} 前去查看！`;

        // 自定义模板以及默认模板
        let _template = process.env.QMSG_TEMPLATE || QmsgTemplate;
        request(`https://qmsg.zendee.cn/send/${process.env.QMSG_KEY}?msg=${encodeURIComponent(_template)}`,
            function (error, response, body) {
                if (error) return console.log("发送QQ提醒异常：", error);
                console.log(body);
                if (body) body = JSON.parse(body);
                if (response.statusCode === 200 && body.success === true)
                    console.log("已发送QQ提醒");
                else console.warn("QQ提醒失败:", body);
            }
        );
    }
};

/**
 * 通知被@的用户
 * @param currentComment
 * @param parentComment
 */
exports.send = (currentComment, parentComment) => {
    // 站长被 @ 不需要提醒
    if (parentComment.get('mail') === process.env.TO_EMAIL
        || parentComment.get('mail') === process.env.SMTP_USER) {
        return;
    }
    let emailSubject = `👉 叮咚！${parentComment.get("nick")}您好，「${process.env.SITE_NAME}」上有人@了你，博客回复通知！`;
    let emailContent = sendTemplate({
        siteName: process.env.SITE_NAME,
        siteUrl: process.env.SITE_URL,
        pname: parentComment.get('nick'),
        ptext: parentComment.get('comment'),
        name: currentComment.get('nick'),
        text: currentComment.get('comment'),
        url: process.env.SITE_URL + currentComment.get('url')
    });
    let mailOptions = {
        from: '"' + process.env.SENDER_NAME + '" <' + process.env.SMTP_USER + '>',
        to: parentComment.get('mail'),
        subject: emailSubject,
        html: emailContent
    };

    transporter.sendMail(mailOptions, (error, success) => {
        if (error) {
            return console.log(error);
        }
        let msg = `${currentComment.get('nick')} @ ${parentComment.get('nick')}通知邮件成功发送:`
        console.log(msg+" %s", success.response);
        currentComment.set("isNotified", true);
        currentComment.save();
    });
};
