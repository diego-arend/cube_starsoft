import { BaseMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";

export interface ChatModelLike {
  invoke(
    input: BaseMessage[] | string,
    config?: RunnableConfig
  ): Promise<BaseMessage>;
  stream(
    input: BaseMessage[] | string,
    config?: RunnableConfig
  ): AsyncIterable<BaseMessage> | Promise<AsyncIterable<BaseMessage>>;
}
