import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { CONSENT_CHANGED } from "./consent";
import { waitForMountMeasurement } from "./mount";
function browser(t: TestContext, granted = true) {
  const values = new Map(granted ? [["hs_analytics_consent", "granted"]] : []);
  const target = new EventTarget(); const calls: unknown[][] = [];
  const window = {location:new URL("https://hobbysalon.nl/workshops?secret=private"), hsGa4Ready:false,
    "ga-disable-G-KP9BXCEF2Z":false,localStorage:{getItem:(k:string)=>values.get(k)??null},
    addEventListener:target.addEventListener.bind(target),removeEventListener:target.removeEventListener.bind(target),
    dispatchEvent:target.dispatchEvent.bind(target),gtag:(...args:unknown[])=>calls.push(args)};
  const document = {cookie:granted ? "hs_analytics_consent=granted" : "",referrer:""};
  for (const [key,value] of Object.entries({window,document})) {
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>previous?Object.defineProperty(globalThis,key,previous):Reflect.deleteProperty(globalThis,key));
  }
  return {window,document,values,calls,ready:()=>{window.hsGa4Ready=true;window.dispatchEvent(new Event("hs:ga4_ready"));}};
}
test("consented mount waits for transport once and sends only sanitized event",t=>{const f=browser(t);let done=0;waitForMountMeasurement("checkout_started",{item_count:2,email:"private"},()=>done++);assert.equal(f.calls.length,0);f.ready();f.ready();assert.equal(done,1);assert.equal(f.calls.length,1);assert.equal(f.calls[0][1],"begin_checkout");assert.ok(!JSON.stringify(f.calls).includes("private"));});
test("pre-consent mount is discarded and never replayed",t=>{const f=browser(t,false);waitForMountMeasurement("project_view",{},()=>{});f.values.set("hs_analytics_consent","granted");f.document.cookie="hs_analytics_consent=granted";f.ready();assert.equal(f.calls.length,0);});
test("withdrawal cancels a pending consented mount",t=>{const f=browser(t);waitForMountMeasurement("project_view",{},()=>{});f.values.set("hs_analytics_consent","denied");f.window.dispatchEvent(new Event(CONSENT_CHANGED));f.values.set("hs_analytics_consent","granted");f.ready();assert.equal(f.calls.length,0);});
test("unmount cleanup cancels pending delivery",t=>{const f=browser(t);const cancel=waitForMountMeasurement("project_view",{},()=>{});cancel();f.ready();assert.equal(f.calls.length,0);});
