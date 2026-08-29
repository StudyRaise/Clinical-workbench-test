import { createKnowledgeStreamParser } from './api';

describe('createKnowledgeStreamParser', () => {
  it('累积 delta 并回调 onDelta', () => {
    const onDelta = jest.fn();
    const parser = createKnowledgeStreamParser('conv-1', onDelta);
    parser.push('data: {"delta": "你好"}');
    parser.push('data: {"delta": "，世界"}');
    expect(onDelta).toHaveBeenLastCalledWith('你好，世界', '');
    expect(parser.result().answer).toBe('你好，世界');
    expect(parser.result().conversationId).toBe('conv-1');
  });

  it('累积 reasoning_content（思考模式）', () => {
    const onDelta = jest.fn();
    const parser = createKnowledgeStreamParser('c', onDelta);
    parser.push('data: {"reasoning_content": "先分析"}');
    parser.push('data: {"reasoning_content": "再总结"}');
    expect(onDelta).toHaveBeenLastCalledWith('', '先分析再总结');
  });

  it('message 字段覆盖最终完整回答', () => {
    const parser = createKnowledgeStreamParser('c', () => {});
    parser.push('data: {"delta": "部分"}');
    parser.push('data: {"message": "完整回答"}');
    expect(parser.result().answer).toBe('完整回答');
  });

  it('提取 knowledge_base_results 为 sources（含 uri）', () => {
    const parser = createKnowledgeStreamParser('c', () => {});
    parser.push(
      'data: {"knowledge_base_results": [{"page_content": "片段", "confidence": 0.9, "document": {"display_name": "指南.pdf", "uri": "https://example.com/dl"}}]}'
    );
    const { sources } = parser.result();
    expect(sources).toHaveLength(1);
    expect(sources[0]).toEqual({
      page_content: '片段',
      document_name: '指南.pdf',
      score: 0.9,
      uri: 'https://example.com/dl'
    });
  });

  it('conversation_id 可被服务端返回值更新', () => {
    const parser = createKnowledgeStreamParser('c', () => {});
    parser.push('data: {"conversation_id": "server-conv"}');
    expect(parser.result().conversationId).toBe('server-conv');
  });

  it('忽略无 data 行与非法 JSON', () => {
    const onDelta = jest.fn();
    const parser = createKnowledgeStreamParser('c', onDelta);
    parser.push('event: ping');
    parser.push('data: {不是json}');
    expect(onDelta).not.toHaveBeenCalled();
    expect(parser.result().answer).toBe('');
  });
});
