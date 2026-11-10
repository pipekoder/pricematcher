"use client";

import { useEffect, useRef, useState } from "react";

export function remainingSeconds(expiresAt:string,now=Date.now()){return Math.max(0,Math.ceil((Date.parse(expiresAt)-now)/1000));}
export function countdownText(seconds:number){return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;}

export function OfferCountdown({expiresAt,onExpired}:{expiresAt:string;onExpired:()=>void}){
  const [seconds,setSeconds]=useState(()=>remainingSeconds(expiresAt));
  const callback=useRef(onExpired);
  useEffect(()=>{callback.current=onExpired;},[onExpired]);
  useEffect(()=>{
    let notified=false;
    const tick=()=>{const next=remainingSeconds(expiresAt);setSeconds(next);if(next===0&&!notified){notified=true;callback.current();}};
    tick();
    const timer=window.setInterval(tick,1000);
    return()=>window.clearInterval(timer);
  },[expiresAt]);
  return <p className="offer-countdown" role="timer">Offer expires in {countdownText(seconds)}</p>;
}
