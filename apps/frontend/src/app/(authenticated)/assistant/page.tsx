"use client";

import React from "react";
import { AssistantClient } from "./assistant-client";

export default function AssistantPage() {
  return (
    <div className="-mx-4 -mt-6 md:-mx-8 md:-mt-8 h-[calc(100dvh-64px)] flex flex-col overflow-hidden">
      <AssistantClient />
    </div>
  );
}
