#!/usr/bin/env ruby
# -*- coding: utf-8 -*-
require 'rubygems'
require 'bundler/setup'
require 'mechanize'
require 'tweetstream'
require 'open-uri'
require 'logger'
require 'uri'
require 'net/https'
require 'dm-core'

DataMapper.setup(:default, 'mongo://%s/oneinvites' % ENV['mongo'])

class Emailsaccounts
  include DataMapper::Mongo::Resource

  property :id, ObjectId
  property :email, String
  property :password, String
  property :invite, Boolean, :default  => false
  property :sell, Boolean, :default  => false
  property :created_at, Date
  property :updated_at, Date
end

DataMapper.finalize

class Oneplus
  attr_accessor :date_start, :date_end, :title

  def initialize(st, en, ti)
    @date_start = st
    @date_end = en
    @title = ti
  end
end

@us = Emailsaccounts.first(:order => [ :created_at.asc ])
puts @us.email

@user = @us.email
@pass = @us.password

TweetStream.configure do |config|
  config.consumer_key       = ENV['TWITTER_CONSUMER_KEY']
  config.consumer_secret    = ENV['TWITTER_CONSUMER_KEY_SECRET']
  config.oauth_token        = ENV['TWITTER_ACCESS_TOKEN']
  config.oauth_token_secret = ENV['TWITTER_ACCESS_TOKEN_SECRET']
  config.auth_method        = :oauth
end

@a = Mechanize.new { |agent|
  agent.user_agent_alias = 'Windows Chrome'
}

@count = 0
begin
  @a.get('https://account.oneplus.net/login') do |app|
    app.form_with(:action => 'https://account.oneplus.net/login') do |f|
      f.email      = @user
      f.password   = @pass
    end.click_button
  end
rescue
 puts "Error FORM"
end

puts @a.page.body.inspect

def getinvite(url)
  begin
    @a.get(url) do |m|
      if (m.uri.to_s.match(/invites.oneplus.net/i))
        @t2 = Time.now
        delta = @t2 - @t1
        puts "Time #{delta}"
        puts m.uri.to_s
        puts m.body.inspect
        urlp = URI.parse('https://api.pushover.net/1/messages.json')
        req = Net::HTTP::Post.new(urlp.path)
        req.set_form_data({
                            :token => ENV['PUSHOVER_TOKEN'],
                            :user => ENV['PUSHOVER_USER'],
                            :title => 'OnePlus Invite',
                            :message => "#{@us.email}\n#{left} invite"
                          })
        res = Net::HTTP.new(urlp.host, urlp.port)
        res.use_ssl = true
        res.verify_mode = OpenSSL::SSL::VERIFY_PEER
        res.start { |http|
          http.request(req)
        }
        # my_form = m.form_with(:action => m.uri.to_s)
        # if !my_form.nil?
        #   my_form.submit
        #   @a.get('https://invites.oneplus.net/my-invites') do |app|
        #     inv = Array.new
        #     app.search('.invite-card').each do |invite|
        #       inv.push(Oneplus.new(invite.attributes['data-start'].text.strip, invite.attributes['data-end'].text.strip, invite.at('h4').text.strip))
        #     end
        #     d = inv.sort { |a,b| b.date_start <=> a.date_start }
        #     if !d[0].nil?
        #       t1 = d[0].date_start.to_i
        #       t2 = d[0].date_end.to_i
        #       @us.update(:start => t1, :end => t2)
        #       left = Time.at(t2-t1).utc.strftime('%e').to_i-1
        #       urlp = URI.parse('https://api.pushover.net/1/messages.json')
        #       req = Net::HTTP::Post.new(urlp.path)
        #       req.set_form_data({
        #                           :token => ENV['PUSHOVER_TOKEN'],
        #                           :user => ENV['PUSHOVER_USER'],
        #                           :title => d[0].title,
        #                           :message => "#{@us.email}\n#{left} #{'day'.pluralize(left)}"
        #                         })
        #       res = Net::HTTP.new(urlp.host, urlp.port)
        #       res.use_ssl = true
        #       res.verify_mode = OpenSSL::SSL::VERIFY_PEER
        #       res.start { |http|
        #         http.request(req)
        #       }
        #     end
        #     @a.get('https://account.oneplus.net/logout') do |out|
        #       logout = out.form_with(:action => 'https://account.oneplus.net/logout')
        #       logout.submit
        #     end
        #     @us = Users.first(:order => [ :start.asc ])
        #     @a.get('https://account.oneplus.net/login') do |app|
        #       app.form_with(:action => 'https://account.oneplus.net/login') do |f|
        #         f.email      = @us.email
        #         f.password   = @us.password
        #       end.click_button
        #     end
        #   end
        # else
        #   puts 'Used invite'
        # end
      else
        puts 'Wrong url'
      end
    end
  rescue
    puts "Error"
  end
end

TweetStream::Client.new.on_error do |message|
  puts "Error twitter stream"
  puts message
end.track('oneplus') do |status|
  puts "#{status.text}"
  #test links
  #text = 'oneplus https://t.co/0JY07GelLz http://t.co/kBKZcHACrH http://t.co/yoaQnLGlnw http://t.co/ckatzqRi4t http://t.co/Ejr366bbFq http://t.co/o0HlgaEjzF'
  #urls = URI.extract(text, ['http', 'https'])
  urls = URI.extract(status.text, ['http', 'https'])
  urls.each do |u|
    @t1 = Time.now
    @a.get(u) do |p|
      html = Nokogiri::HTML(p.body)
      s = html.xpath('//noscript/meta')[0]
      url = s['content'].replace(s['content'].gsub(/0;URL=/, ''))
      if (url.match(/invites.oneplus.net/i))
        getinvite(url)
      elsif (url.match(/onepl.us/i))
        getinvite(url)
      elsif (url.match(/mandrillapp.com/i))
        getinvite(url)
      elsif (url.match(/bit.ly/i))
        getinvite(url)
      elsif (url.match(/j.mp/i))
        getinvite(url)
      elsif (url.match(/ow.ly/i))
        getinvite(url)
      elsif (url.match(/goo.gl/i))
        getinvite(url)
      elsif (url.match(/fb.me/i))
        getinvite(url)
      elsif (url.match(/lnkd.in/i))
        getinvite(url)
      end
    end
  end
  if (@count == 20)
    puts @count
    @a.get('https://invites.oneplus.net/my-invites')
    puts @a.page.body.inspect
    @count = 0
  else
    puts @count
    @count = @count + 1
  end
end
