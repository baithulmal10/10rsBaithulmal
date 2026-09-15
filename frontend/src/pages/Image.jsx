import React from "react";

export default function Receipt({
  receiptNo = "10RS20260978338",
  donor = "MOHAMED IMAMDEEN",
  paymentDate = "2026-09-13",
  forMonth = "xxxxxxxxxx",
  amount = "4,444",
}) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700;800;900&display=swap');

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #e8e8e8;
        }

        .receipt-page {
          width: 100%;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 20px;
          overflow: auto;
        }

        /*
          IMPORTANT:
          The actual receipt is ALWAYS 1024 x 1448.
          Everything inside uses absolute coordinates.
        */

        .receipt {
          position: relative;

          width: 1024px;
          height: 1448px;

          flex-shrink: 0;

          background: #f8fff8;

          border: 12px solid #d5a600;

          overflow: hidden;

          font-family: "Noto Sans Tamil", Arial, sans-serif;

          color: #075a3b;

          transform-origin: top center;
        }

        /* Inner gold border */

        .inner-border {
          position: absolute;

          left: 15px;
          top: 15px;
          right: 15px;
          bottom: 15px;

          border: 3px solid #d5a600;

          pointer-events: none;
        }

        /* Corner decorations */

        .corner {
          position: absolute;

          width: 55px;
          height: 55px;

          color: #d5a600;

          font-size: 42px;

          display: flex;
          justify-content: center;
          align-items: center;

          z-index: 10;
        }

        .corner.tl {
          left: 4px;
          top: 4px;
        }

        .corner.tr {
          right: 4px;
          top: 4px;
        }

        .corner.bl {
          left: 4px;
          bottom: 4px;
        }

        .corner.br {
          right: 4px;
          bottom: 4px;
        }

        /* =========================
           LOGO
        ========================= */

        .logo {
          position: absolute;

          left: 48px;
          top: 45px;

          width: 185px;
          height: 160px;

          display: flex;
          justify-content: center;
          align-items: center;
        }

        .logo-circle {
          position: relative;

          width: 145px;
          height: 145px;

          border: 6px solid #1494a5;

          border-radius: 50%;

          display: flex;
          justify-content: center;
          align-items: center;

          overflow: hidden;
        }

        .logo-building {
          font-size: 60px;
          line-height: 1;

          margin-top: -15px;
        }

        .logo-text {
          position: absolute;

          bottom: 12px;

          width: 130px;

          text-align: center;

          font-family: Arial, sans-serif;

          font-size: 9px;

          font-weight: bold;

          color: #075a3b;
        }

        /* =========================
           MAIN TITLE
        ========================= */

        .main-title {
          position: absolute;

          left: 235px;
          top: 45px;

          width: 555px;

          text-align: center;

          font-size: 55px;

          line-height: 1.08;

          font-weight: 900;

          color: #075a3b;

          margin: 0;
        }

        /* tagline */

        .tagline {
          position: absolute;

          left: 275px;
          top: 220px;

          width: 475px;

          display: flex;

          justify-content: center;
          align-items: center;

          gap: 18px;

          font-size: 23px;

          font-weight: 800;

          white-space: nowrap;
        }

        .tagline-line {
          width: 55px;
          height: 4px;

          background: #d5a600;

          flex-shrink: 0;
        }

        /* =========================
           COIN
        ========================= */

        .coin {
          position: absolute;

          right: 45px;
          top: 50px;

          width: 135px;
          height: 135px;

          border-radius: 50%;

          border: 5px solid #bd8d00;

          background:
            radial-gradient(
              circle,
              #f7d96b 0%,
              #d4a31c 65%,
              #f3d25d 100%
            );

          box-shadow:
            inset 0 0 0 4px #f5df87,
            0 5px 10px rgba(0,0,0,0.25);

          display: flex;

          flex-direction: column;

          justify-content: center;

          align-items: center;

          color: #775400;
        }

        .coin-symbol {
          font-size: 34px;
          line-height: 30px;
        }

        .coin-india {
          font-family: Georgia, serif;
          font-size: 13px;
          font-weight: bold;
        }

        .coin-rs {
          font-size: 27px;
          font-weight: bold;
        }

        /* =========================
           RECEIPT TITLE
        ========================= */

        .receipt-title {
          position: absolute;

          left: 210px;
          top: 270px;

          width: 600px;
          height: 115px;
        }

        .receipt-title-box {
          position: absolute;

          left: 30px;
          top: 0;

          width: 540px;
          height: 72px;

          background: #075a3b;

          border: 5px solid #d5a600;

          display: flex;

          justify-content: center;
          align-items: center;

          clip-path: polygon(
            4% 0,
            96% 0,
            100% 50%,
            96% 100%,
            4% 100%,
            0 50%
          );
        }

        .receipt-title-box span {
          color: white;

          font-family: Georgia, serif;

          font-size: 47px;

          font-weight: bold;

          letter-spacing: 3px;
        }

        .title-flower {
          position: absolute;

          top: 5px;

          color: #80a900;

          font-size: 48px;
        }

        .title-flower.left {
          left: 0;
        }

        .title-flower.right {
          right: 0;
        }

        .tamil-receipt {
          position: absolute;

          top: 74px;

          left: 0;

          width: 600px;

          text-align: center;

          font-size: 46px;

          font-weight: 900;
        }

        /* =========================
           DETAILS BOX
        ========================= */

        .details {
          position: absolute;

          left: 36px;
          top: 445px;

          width: 940px;
          height: 405px;

          border: 3px solid #075a3b;

          border-radius: 16px;

          padding: 10px 38px;
        }

        .row {
          position: relative;

          width: 100%;
          height: 66px;

          display: flex;

          align-items: center;

          border-bottom: 1px solid #6c9a88;

          font-family: Arial, sans-serif;

          font-size: 30px;

          font-weight: 700;
        }

        .row:last-of-type {
          border-bottom: none;
        }

        .row-label {
          width: 310px;

          flex-shrink: 0;
        }

        .row-colon {
          width: 35px;

          flex-shrink: 0;

          text-align: center;
        }

        .row-value {
          flex: 1;

          white-space: nowrap;

          overflow: hidden;

          color: #075a3b;

          font-weight: 800;
        }

        /* =========================
           TOTAL
        ========================= */

        .total {
          position: absolute;

          left: 170px;
          bottom: 17px;

          width: 600px;
          height: 82px;

          background: #075a3b;

          border: 5px solid #d5a600;

          color: white;

          display: flex;

          justify-content: center;

          align-items: center;

          font-family: Georgia, serif;

          font-size: 43px;

          font-weight: bold;

          clip-path: polygon(
            5% 0,
            95% 0,
            100% 50%,
            95% 100%,
            5% 100%,
            0 50%
          );
        }

        .total strong {
          font-size: 47px;

          margin-left: 8px;
        }

        /* =========================
           ORNAMENT
        ========================= */

        .ornament {
          position: absolute;

          left: 225px;
          top: 868px;

          width: 575px;

          height: 35px;

          display: flex;

          align-items: center;

          justify-content: center;

          gap: 12px;

          font-size: 29px;
        }

        .ornament-line {
          width: 250px;
          height: 2px;

          background: #075a3b;
        }

        /* =========================
           THANK YOU BOX
        ========================= */

        .thanks {
          position: absolute;

          left: 160px;
          top: 900px;

          width: 705px;

          height: 90px;

          display: flex;

          align-items: center;

          justify-content: center;

          gap: 12px;
        }

        .thanks-flower {
          color: #80a900;

          font-size: 48px;
        }

        .thanks-box {
          width: 575px;

          height: 78px;

          background: #075a3b;

          border: 5px solid #d5a600;

          display: flex;

          justify-content: center;

          align-items: center;

          color: white;

          font-size: 35px;

          font-weight: 900;

          white-space: nowrap;

          clip-path: polygon(
            4% 0,
            96% 0,
            100% 50%,
            96% 100%,
            4% 100%,
            0 50%
          );
        }

        /* =========================
           MESSAGE
        ========================= */

        .message {
  position: absolute;

  left: 90px;
  top: 995px;

  width: 830px;

  text-align: center;

  color: #075a3b;

  font-size: 20px;

  line-height: 1.55;

  font-weight: 600;
}

.message p {
  margin: 0 0 14px 0;
}

        .message p {
          margin: 0 0 20px 0;
        }

        /* Bottom ornament */

        .bottom-ornament {
          position: absolute;

          left: 225px;
          bottom: 28px;

          width: 575px;

          display: flex;

          justify-content: center;

          align-items: center;

          gap: 12px;

          font-size: 29px;
        }

        /* =========================
           MOBILE
        ========================= */

        @media (max-width: 1050px) {
          .receipt-page {
            padding: 10px;
          }

          .receipt {
            /*
              Scale the entire 1024 x 1448 receipt
              instead of changing its internal layout.
            */

            transform: scale(
              min(
                calc((100vw - 20px) / 1024),
                1
              )
            );

            margin-bottom: calc(
              -1448px +
              (1448px * min(calc((100vw - 20px) / 1024), 1))
            );
          }
        }
      `}</style>

      <div className="receipt-page">

        <div className="receipt">

          {/* Border */}
          <div className="inner-border" />

          {/* Corners */}
          <div className="corner tl">❖</div>
          <div className="corner tr">❖</div>
          <div className="corner bl">❖</div>
          <div className="corner br">❖</div>

          {/* LOGO */}
          <div className="logo">
            <div className="logo-circle">
              <div className="logo-building">
                🏛️
              </div>

              <div className="logo-text">
                YOUTH HASID SEVAI KUZHU - YMSK
              </div>
            </div>
          </div>

          {/* MAIN TITLE */}
          <h1 className="main-title">
            10 ரூபாய்
            <br />
            பைத்துல்மால்
          </h1>

          {/* TAGLINE */}
          <div className="tagline">
            <div className="tagline-line" />

            <span>
              நன்மையிலும் பயத்திலும்
            </span>

            <div className="tagline-line" />
          </div>

          {/* COIN */}
          <div className="coin">
            <div className="coin-symbol">
              ♛
            </div>

            <div className="coin-india">
              INDIA
            </div>

            <div className="coin-rs">
              ₹10
            </div>
          </div>

          {/* RECEIPT HEADING */}
          <div className="receipt-title">

            <div className="title-flower left">
              ❀
            </div>

            <div className="receipt-title-box">
              <span>
                RECEIPT
              </span>
            </div>

            <div className="title-flower right">
              ❀
            </div>

            <div className="tamil-receipt">
              ரசீது
            </div>

          </div>

          {/* DETAILS */}
          <div className="details">

            <div className="row">
              <div className="row-label">
                Receipt #
              </div>

              <div className="row-colon">
                :
              </div>

              <div className="row-value">
                {receiptNo}
              </div>
            </div>

            <div className="row">
              <div className="row-label">
                Donor
              </div>

              <div className="row-colon">
                :
              </div>

              <div className="row-value">
                {donor}
              </div>
            </div>

            <div className="row">
              <div className="row-label">
                Payment Date
              </div>

              <div className="row-colon">
                :
              </div>

              <div className="row-value">
                {paymentDate}
              </div>
            </div>

            <div className="row">
              <div className="row-label">
                For Month
              </div>

              <div className="row-colon">
                :
              </div>

              <div className="row-value">
                {forMonth}
              </div>
            </div>

            {/* TOTAL */}
            <div className="total">
              <span>
                Total :
              </span>

              <strong>
                ₹{amount}
              </strong>
            </div>

          </div>

          {/* ORNAMENT */}
          <div className="ornament">
            <div className="ornament-line" />
            <span>❧</span>
            <div className="ornament-line" />
          </div>

          {/* THANKS */}
          <div className="thanks">

            <div className="thanks-flower">
              ❀
            </div>

            <div className="thanks-box">
              ஜஸாகல்லாஹ் ஹைரன்
            </div>

            <div className="thanks-flower">
              ❀
            </div>

          </div>

          {/* MESSAGE */}
          <div className="message">

            <p>
              10 ரூபாய் பைத்துல்மாலுக்கு நிதி உதவி
              செய்த தங்களுக்கும், உங்களுடைய
              குடும்பத்தார்கள் மற்றும் முன்னோர்கள்
              அனைவர்களுக்கும் அல்லாஹ்விடத்திலா
              இம்மை, மறுமை சுகைத்தைிலும் வெற்றியை
              தந்தருள்வானாக...
            </p>

            <p>
              உங்களுடைய பொருளாதாரத்தில்,
              வியாபாரத்தில் பரக்கத் செய்வானாக ...
            </p>

            <p>
              ஜென்னத்தில் பிர்தௌஸ் என்னும் உயரிய
              சொர்க்கத்தை உங்களுக்கும், உங்களுடைய
              மனைவி, பிள்ளைகள், உங்களுடைய
              உறவினர்கள், சந்ததியினர் மற்றும்
              முன்னோர்கள் அனைவருக்கும்
              தந்தருள்வானாக... ஆமீன்
            </p>

          </div>

          {/* BOTTOM ORNAMENT */}
          <div className="bottom-ornament">
            <div className="ornament-line" />
            <span>❧</span>
            <div className="ornament-line" />
          </div>

        </div>
      </div>
    </>
  );
}